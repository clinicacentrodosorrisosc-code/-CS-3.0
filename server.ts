/* eslint-disable react-hooks/rules-of-hooks */
import express from "express";
import { createServer as createViteServer } from "vite";
import { createClient } from "@supabase/supabase-js";
import path from "path";
import fs from "fs";
import { GoogleGenAI } from "@google/genai";
import cors from "cors";
import makeWASocket, { 
  DisconnectReason, 
  useMultiFileAuthState, 
  Browsers,
  delay
} from "@whiskeysockets/baileys";
import QRCode from "qrcode";
import pino from "pino";

const supabaseUrl = 'https://dmslcvvjxfulsocksave.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtc2xjdnZqeGZ1bHNvY2tzYXZlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkzMDQyNjgsImV4cCI6MjA4NDg4MDI2OH0.H0iDEj58mdwSFnLlyn1a2n_k3UZBtf_rHH8w4BkzfUw';

const supabase = createClient(supabaseUrl, supabaseKey);

// WhatsApp State
let sock: any = null;
let lastQR: string | null = null;
let connectionStatus: 'connected' | 'disconnected' | 'connecting' = 'disconnected';

async function connectToWhatsApp(isBackground = false) {
  const { state, saveCreds } = await useMultiFileAuthState('whatsapp_auth_info');
  
  sock = makeWASocket({
    auth: state,
    printQRInTerminal: !isBackground,
    logger: pino({ level: 'silent' }),
    browser: Browsers.ubuntu('Chrome'),
  });

  console.log(`>>> [WHATSAPP] Iniciar conexão... (Background: ${isBackground})`);

  sock.ev.on('connection.update', async (update: any) => {
    const { connection, lastDisconnect, qr } = update;
    
    if (qr) {
      if (isBackground) {
        console.log('>>> [WHATSAPP] Detectado QR em conexão de background. Credenciais inválidas/expiradas. Cancelando e limpando pasta.');
        connectionStatus = 'disconnected';
        lastQR = null;
        try {
          sock.end(new Error('Background connection needs scan'));
        } catch {
          // Ignorar erros ao encerrar o socket em background
        }
        sock = null;
        try {
          fs.rmSync('whatsapp_auth_info', { recursive: true, force: true });
        } catch (err) {
          console.error('>>> [WHATSAPP] Erro ao remover pasta whatsapp_auth_info:', err);
        }
        return;
      }

      console.log('>>> [WHATSAPP] Novo QR Code gerado');
      lastQR = await QRCode.toDataURL(qr);
      connectionStatus = 'connecting';
    }

    if (connection === 'close') {
      const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
      let shouldReconnect = statusCode !== DisconnectReason.loggedOut;
      const errorMessage = (lastDisconnect?.error as any)?.message;
      const errorStr = (lastDisconnect?.error as any)?.toString() || "";
      
      console.log(`>>> [WHATSAPP] Conexão fechada. Status: ${statusCode}. Erro: ${errorMessage}. Reconectando: ${shouldReconnect}`);
      
      connectionStatus = 'disconnected';
      lastQR = null;

      // Se o erro for de tentativas de QR expiradas, limpamos o socket para permitir nova tentativa e paramos reconexão automática
      if (errorMessage === 'QR refs attempts ended' || statusCode === 401 || errorStr.includes('QR refs attempts ended')) {
        console.log('>>> [WHATSAPP] Resetando socket devido a erro de timeout ou expiração.');
        sock = null;
        shouldReconnect = false;
      }

      if (shouldReconnect) {
        connectToWhatsApp(isBackground);
      }
    } else if (connection === 'open') {
      console.log('>>> [WHATSAPP] Conectado com sucesso!');
      connectionStatus = 'connected';
      lastQR = null;
    }
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('messages.upsert', async (m: any) => {
    if (m.type === 'notify') {
      for (const msg of m.messages) {
        if (!msg.key.fromMe && msg.message) {
          const from = msg.key.remoteJid;
          const text = msg.message.conversation || msg.message.extendedTextMessage?.text || "";
          
          if (text) {
             console.log(`>>> [WHATSAPP] Nova mensagem de ${from}: ${text}`);
             // Save to Supabase
             await saveWhatsAppMessage(from, text, false, msg.key.id);
          }
        }
      }
    }
  });
}

async function saveWhatsAppMessage(phoneNumber: string, text: string, isFromMe: boolean, messageId: string) {
  try {
    // 1. Get or create chat
    const cleanPhone = phoneNumber.split('@')[0];
    let chatData = null;
    const { data: existingChat, error: chatError } = await supabase
      .from('whatsapp_chats')
      .select('id')
      .eq('phone_number', cleanPhone)
      .single();
    
    chatData = existingChat;

    if (chatError && (chatError as any).code === 'PGRST116') { // Not found
      const { data: newChat, error: createError } = await supabase
        .from('whatsapp_chats')
        .insert({ 
          phone_number: cleanPhone, 
          contact_name: cleanPhone,
          last_message: text,
          last_message_at: new Date().toISOString()
        })
        .select()
        .single();
      
      if (createError) throw createError;
      chatData = newChat;
    } else if (chatData) {
      // Update last message
      await supabase
        .from('whatsapp_chats')
        .update({ 
          last_message: text, 
          last_message_at: new Date().toISOString(),
          unread_count: isFromMe ? 0 : 1 // Simplified unread logic
        })
        .eq('id', chatData.id);
    }

    if (chatData) {
      // 2. Save message
      await supabase
        .from('whatsapp_messages')
        .insert({
          chat_id: chatData.id,
          message_id: messageId,
          from_number: isFromMe ? 'me' : cleanPhone,
          to_number: isFromMe ? cleanPhone : 'me',
          text,
          is_from_me: isFromMe,
          status: 'received'
        });
    }
  } catch (error) {
    console.error('>>> [WHATSAPP] Error saving message:', error);
  }
}

// Iniciar conexão WhatsApp em background se já houver sessão
fs.access('whatsapp_auth_info', (err) => {
  if (!err) {
    connectToWhatsApp(true);
  }
});

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
      console.log(`>>> [PROXY] Requesting: ${targetUrl}`);

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
        // Clear all cached GET requests when a mutation occurs to ensure real-time data accuracy
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

      // Forward request body if applicable
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

      // Perform fetch server-side
      console.log(`>>> [PROXY] Fetching URL: ${targetUrl}`);
      const response = await fetch(targetUrl, {
        method: req.method,
        headers,
        body
      });
      console.log(`>>> [PROXY] Response Status: ${response.status} for ${targetUrl}`);

      // Set response status
      res.status(response.status);

      const responseHeaders: [string, string][] = [];
      // Forward response headers
      response.headers.forEach((val, key) => {
        const lowerKey = key.toLowerCase();
        if (!['connection', 'content-encoding', 'transfer-encoding', 'keep-alive', 'content-length'].includes(lowerKey)) {
          res.setHeader(key, val);
          if (isGet) {
            responseHeaders.push([key, val]);
          }
        }
      });

      // Send response body
      const text = await response.text();

      // Cache successful GET responses with a 5-second TTL
      if (isGet && response.status >= 200 && response.status < 300) {
        supabaseProxyCache.set(cacheKey, {
          status: response.status,
          headers: responseHeaders,
          body: text,
          expiresAt: Date.now() + 5000
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
      
      // 1. Validar se quem chama é realmente o administrador clinica.centrodosorrisosc@gmail.com
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

      // 2. Criar a conta de autenticação (SignUp) usando um cliente isolado
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

      // 3. Cadastrar ou atualizar a tabela de perfis (profiles) com o token do administrador
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

  // WhatsApp Routes
  app.get("/api/whatsapp/status", (req, res) => {
    res.json({ status: connectionStatus });
  });

  app.post("/api/whatsapp/connect", async (req, res) => {
    console.log(`>>> [WHATSAPP] Request connect. Status atual: ${connectionStatus}`);
    
    if (connectionStatus === 'connected') {
      return res.json({ status: 'connected' });
    }
    
    if (!sock || connectionStatus === 'disconnected') {
      console.log('>>> [WHATSAPP] Iniciando nova conexão...');
      connectToWhatsApp(false);
    }

    // Aguardar o QR ser gerado ou conexão abrir
    let attempts = 0;
    while (!lastQR && connectionStatus !== 'connected' && attempts < 10) {
      await delay(1000);
      attempts++;
    }

    console.log(`>>> [WHATSAPP] Retornando status: ${connectionStatus}, QR presente: ${!!lastQR}`);
    res.json({ status: connectionStatus, qr: lastQR });
  });

  app.post("/api/whatsapp/reset", async (req, res) => {
    console.log('>>> [WHATSAPP] Reset manual solicitado');
    connectionStatus = 'disconnected';
    lastQR = null;
    sock = null;
    res.json({ status: 'resetting' });
  });

  app.post("/api/whatsapp/send", async (req, res) => {
    try {
      const { to, text } = req.body;
      if (!sock || connectionStatus !== 'connected') {
        return res.status(400).json({ error: "WhatsApp não conectado" });
      }

      const jid = to.includes('@s.whatsapp.net') ? to : `${to}@s.whatsapp.net`;
      const result = await sock.sendMessage(jid, { text });
      
      // Save sent message to Supabase
      if (result) {
        await saveWhatsAppMessage(to, text, true, result.key.id);
      }

      res.json({ success: true, result });
    } catch (error: any) {
      console.error(">>> [WHATSAPP] Error sending message:", error.message);
      res.status(500).json({ error: error.message });
    }
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

  // Global error handler (Must have 4 parameters so Express recognizes it)
  app.use((err: any, req: any, res: any, next: any) => {
    console.error('>>> [SERVER] Global Error:', err);
    if (res.headersSent) {
      return next(err);
    }
    res.status(500).json({ error: 'Erro interno do servidor', details: err?.message || String(err) });
  });
}

// Global Process Exception and Rejection Handlers
process.on('uncaughtException', (err) => {
  console.error('>>> [PROCESS] Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('>>> [PROCESS] Unhandled Rejection at:', promise, 'reason:', reason);
});

startServer();
