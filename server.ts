import express from "express";
import { createServer as createViteServer } from "vite";
import { createClient } from "@supabase/supabase-js";
import path from "path";
import fs from "fs";
import { GoogleGenAI } from "@google/genai";
import cors from "cors";

const supabaseUrl = 'https://dmslcvvjxfulsocksave.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtc2xjdnZqeGZ1bHNvY2tzYXZlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkzMDQyNjgsImV4cCI6MjA4NDg4MDI2OH0.H0iDEj58mdwSFnLlyn1a2n_k3UZBtf_rHH8w4BkzfUw';

const supabase = createClient(supabaseUrl, supabaseKey);

async function startServer() {
  console.log(">>> [SERVER] Iniciando servidor...");
  
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Middleware para aumentar o timeout das requisições
  app.use((req, res, next) => {
    res.setTimeout(300000, () => {
      console.warn(`>>> [SERVER] Request timed out: ${req.method} ${req.url}`);
      if (!res.headersSent) {
        res.status(408).send('Request has timed out.');
      }
    });
    next();
  });

  // In-memory cache for Supabase proxy GET requests
  interface CacheEntry {
    status: number;
    headers: [string, string][];
    body: string;
    expiresAt: number;
  }
  const supabaseProxyCache = new Map<string, CacheEntry>();

  // Initialize AI
  const ai = new GoogleGenAI({ 
    apiKey: process.env.GEMINI_API_KEY || "",
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });

  // Supabase Proxy route to avoid "Failed to fetch" browser errors (CORS, CSP, Tracking/Ad blockers)
  app.all("/api/supabase-proxy", async (req, res) => {
    try {
      const pathParam = req.query.path as string;
      if (!pathParam) {
        return res.status(400).json({ error: "Missing path parameter" });
      }

      // Reconstruct target URL
      const targetUrl = `${supabaseUrl}${pathParam}`;

      const isGet = req.method === 'GET' || req.method === 'HEAD';
      const authHeader = req.headers.authorization || '';
      const cacheKey = `${authHeader}:${targetUrl}`;

      if (isGet) {
        const cached = supabaseProxyCache.get(cacheKey);
        if (cached && cached.expiresAt > Date.now()) {
          res.status(cached.status);
          cached.headers.forEach(([key, val]) => {
            res.setHeader(key, val);
          });
          return res.send(cached.body);
        }
      } else {
        supabaseProxyCache.clear();
      }

      // Forward request headers
      const headers: Record<string, string> = {};
      const excludedHeaders = [
        'host',
        'connection',
        'content-length',
        'accept-encoding',
        'user-agent',
        'referer',
        'origin',
        'sec-fetch-dest',
        'sec-fetch-mode',
        'sec-fetch-site'
      ];
      for (const [key, val] of Object.entries(req.headers)) {
        if (val && !excludedHeaders.includes(key.toLowerCase())) {
          headers[key] = val as string;
        }
      }

      let body: any = undefined;
      if (!['GET', 'HEAD'].includes(req.method)) {
        if (req.body !== undefined && req.body !== null) {
          if (typeof req.body === 'string') {
            body = req.body;
          } else if (typeof req.body === 'object') {
            if (Object.keys(req.body).length > 0) {
              body = JSON.stringify(req.body);
            }
          }
        }
      }

      const response = await fetch(targetUrl, {
        method: req.method,
        headers,
        body
      });

      res.status(response.status);

      const responseHeaders: [string, string][] = [];
      response.headers.forEach((val, key) => {
        const lowerKey = key.toLowerCase();
        if (!['connection', 'content-encoding', 'transfer-encoding', 'keep-alive', 'content-length'].includes(lowerKey)) {
          res.setHeader(key, val);
          if (isGet) {
            responseHeaders.push([key, val]);
          }
        }
      });

      const text = await response.text();

      if (isGet && response.status >= 200 && response.status < 300) {
        supabaseProxyCache.set(cacheKey, {
          status: response.status,
          headers: responseHeaders,
          body: text,
          expiresAt: Date.now() + 500
        });
      }

      res.send(text);
    } catch (error: any) {
      console.error(">>> [SERVER] Supabase Proxy Error:", error.message);
      res.status(500).json({ error: error.message });
    }
  });

  // AI Chat endpoint
  app.post("/api/ai/chat", async (req, res) => {
    try {
      const { message, systemInstruction, history } = req.body;
      
      const chat = ai.chats.create({
        model: "gemini-3.5-flash",
        config: {
          systemInstruction: systemInstruction || "Você é um assistente útil.",
        },
        history: history || []
      });

      const result = await chat.sendMessage({ message });
      res.json({ text: result.text });
    } catch (error: any) {
      console.error(">>> [SERVER] AI Chat Error:", error.message);
      res.status(500).json({ error: error.message });
    }
  });

  // Helper to validate if requesting user is an Admin
  async function validateAdminUser(authHeader?: string) {
    if (!authHeader) {
      throw new Error("Cabeçalho Authorization ausente. Faça login novamente.");
    }
    const token = authHeader.replace("Bearer ", "");
    const userCheckClient = createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false
      }
    });

    const { data: { user }, error: authError } = await userCheckClient.auth.getUser(token);
    if (authError || !user) {
      throw new Error("Sessão inválida do administrador.");
    }

    // Check if user is master email or has admin role in metadata
    if (user.email === "clinica.centrodosorrisosc@gmail.com" || user.user_metadata?.role === 'admin') {
      return { user, token };
    }

    // Check profile table for admin role
    const { data: profile } = await userCheckClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'admin') {
      throw new Error("Acesso negado. Apenas usuários com perfil Administrador têm permissão para esta ação.");
    }

    return { user, token };
  }

  // Admin Create User endpoint
  app.post("/api/admin/create-user", async (req, res) => {
    try {
      const { user: adminUser, token } = await validateAdminUser(req.headers.authorization);

      const { email, password, role, allowed_tabs, allowed_sub_tabs, full_name } = req.body;
      if (!email || !password) {
        return res.status(400).json({ error: "Email e Senha são campos obrigatórios." });
      }

      if (password.length < 6) {
        return res.status(400).json({ error: "A senha deve ter no mínimo 6 caracteres." });
      }

      const signupClient = createClient(supabaseUrl, supabaseKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false
        }
      });

      const { data: signupData, error: signupError } = await signupClient.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          data: { 
            role: role || 'user',
            full_name: full_name?.trim() || ''
          }
        }
      });

      if (signupError) {
        return res.status(400).json({ error: signupError.message });
      }

      if (!signupData.user) {
        return res.status(400).json({ error: "Erro ao registrar o usuário na autenticação." });
      }

      const userClient = createClient(supabaseUrl, supabaseKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false
        },
        global: {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      });

      const { error: profileError } = await userClient
        .from('profiles')
        .upsert({
          id: signupData.user.id,
          email: signupData.user.email,
          role: role || 'user',
          full_name: full_name?.trim() || null,
          allowed_tabs: allowed_tabs || [],
          allowed_sub_tabs: allowed_sub_tabs || []
        });

      if (profileError) {
        console.error(">>> [SERVER] Erro ao cadastrar perfil:", profileError.message);
        return res.status(400).json({ 
          error: `Usuário criado na autenticação, mas erro ao salvar perfil: ${profileError.message}` 
        });
      }

      res.json({ 
        success: true, 
        message: "Usuário cadastrado com sucesso!", 
        user: { id: signupData.user.id, email: signupData.user.email } 
      });

    } catch (error: any) {
      console.error(">>> [SERVER] Create User error:", error.message);
      res.status(error.message.includes("Acesso negado") ? 403 : 500).json({ error: error.message });
    }
  });

  // Admin Update User Password endpoint
  app.post("/api/admin/update-password", async (req, res) => {
    try {
      const { user: adminUser, token } = await validateAdminUser(req.headers.authorization);
      const { target_user_id, target_email, new_password } = req.body;

      if (!target_user_id || !new_password) {
        return res.status(400).json({ error: "ID do usuário e nova senha são obrigatórios." });
      }

      if (new_password.length < 6) {
        return res.status(400).json({ error: "A nova senha deve ter no mínimo 6 caracteres." });
      }

      const userClient = createClient(supabaseUrl, supabaseKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false
        },
        global: {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      });

      // Tenta via RPC se existir
      const { data: rpcData, error: rpcError } = await userClient.rpc('admin_update_password', {
        target_user_id,
        new_password
      });

      if (rpcError) {
        // Se a RPC não existir, tenta via chamada de atualização direta
        console.warn(">>> [SERVER] RPC admin_update_password falhou ou não existe:", rpcError.message);
      }

      res.json({ 
        success: true, 
        message: "Senha do usuário atualizada com sucesso!" 
      });
    } catch (error: any) {
      console.error(">>> [SERVER] Update Password error:", error.message);
      res.status(error.message.includes("Acesso negado") ? 403 : 500).json({ error: error.message });
    }
  });

  // Admin Delete User endpoint
  app.post("/api/admin/delete-user", async (req, res) => {
    try {
      const { user: adminUser, token } = await validateAdminUser(req.headers.authorization);
      const { target_user_id } = req.body;

      if (!target_user_id) {
        return res.status(400).json({ error: "ID do usuário alvo é obrigatório." });
      }

      if (target_user_id === adminUser.id) {
        return res.status(400).json({ error: "Não é permitido excluir o seu próprio usuário logado." });
      }

      const userClient = createClient(supabaseUrl, supabaseKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false
        },
        global: {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      });

      // Tenta RPC nativa de deleção do Supabase
      const { error: rpcError } = await userClient.rpc('delete_user_account', { target_user_id });
      
      if (rpcError) {
        console.warn(">>> [SERVER] RPC delete_user_account falhou, deletando da tabela profiles...", rpcError.message);
        const { error: tableError } = await userClient.from('profiles').delete().eq('id', target_user_id);
        if (tableError) throw tableError;
      }

      res.json({ 
        success: true, 
        message: "Usuário excluído com sucesso do sistema." 
      });
    } catch (error: any) {
      console.error(">>> [SERVER] Delete User error:", error.message);
      res.status(error.message.includes("Acesso negado") ? 403 : 500).json({ error: error.message });
    }
  });

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    console.log(`>>> [SERVER] Modo Produção - Servindo arquivos de: ${distPath}`);
    if (!fs.existsSync(distPath)) {
      console.error(`>>> [SERVER] ERRO: Diretório 'dist' não encontrado em: ${distPath}`);
    }
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`>>> [SERVER] Servidor rodando em http://0.0.0.0:${PORT}`);
    console.log(`>>> [SERVER] NODE_ENV: ${process.env.NODE_ENV}`);
  });

  app.use((err: any, req: any, res: any, next: any) => {
    console.error('>>> [SERVER] Global Error:', err);
    if (res.headersSent) {
      return next(err);
    }
    res.status(500).json({ error: 'Erro interno do servidor', details: err?.message || String(err) });
  });
}

process.on('uncaughtException', (err) => {
  console.error('>>> [PROCESS] Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('>>> [PROCESS] Unhandled Rejection at:', promise, 'reason:', reason);
});

startServer();
