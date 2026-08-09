import dotenv from "dotenv";
dotenv.config();

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
    apiKey: process.env.GEMINI_API_KEY || "AIzaSy_dummy_key_for_local_dev",
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

  // Admin Create User endpoint
  app.post("/api/admin/create-user", async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        return res.status(401).json({ error: "Cabeçalho Authorization ausente. Faça login novamente." });
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
        return res.status(401).json({ error: "Sessão inválida do administrador." });
      }

      if (user.email !== "clinica.centrodosorrisosc@gmail.com") {
        return res.status(403).json({ error: "Apenas o usuário principal clinica.centrodosorrisosc@gmail.com tem permissão para criar usuários." });
      }

      const { email, password, role, allowed_tabs, allowed_sub_tabs } = req.body;
      if (!email || !password) {
        return res.status(400).json({ error: "Email e Senha são campos obrigatórios." });
      }

      const signupClient = createClient(supabaseUrl, supabaseKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false
        }
      });

      const { data: signupData, error: signupError } = await signupClient.auth.signUp({
        email,
        password,
        options: {
          data: { role: role || 'user' }
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
          allowed_tabs: allowed_tabs || [],
          allowed_sub_tabs: allowed_sub_tabs || []
        });

      if (profileError) {
        console.error(">>> [SERVER] Erro ao cadastrar perfil:", profileError.message);
        return res.status(400).json({ 
          error: `O usuário de login foi criado, mas houve um erro ao criar o perfil correspondente: ${profileError.message}` 
        });
      }

      res.json({ 
        success: true, 
        message: "Usuário e perfil criados com absoluto sucesso!", 
        user: { id: signupData.user.id, email: signupData.user.email } 
      });

    } catch (error: any) {
      console.error(">>> [SERVER] Create User error:", error.message);
      res.status(500).json({ error: error.message });
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
