
import { createClient } from '@supabase/supabase-js';

// Helper to safely access env vars with fallback
const getEnv = (key: string, fallback: string): string => {
  try {
    const env = import.meta && import.meta.env;
    const value = (env && env[key]) ? env[key] : fallback;
    return String(value);
  } catch {
    return fallback;
  }
};

const supabaseUrl = getEnv('VITE_SUPABASE_URL', 'https://dmslcvvjxfulsocksave.supabase.co');
const supabaseKey = getEnv('VITE_SUPABASE_KEY', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtc2xjdnZqeGZ1bHNvY2tzYXZlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkzMDQyNjgsImV4cCI6MjA4NDg4MDI2OH0.H0iDEj58mdwSFnLlyn1a2n_k3UZBtf_rHH8w4BkzfUw');

const customFetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  let urlStr = '';
  let requestObj: Request | null = null;
  
  if (typeof input === 'string') {
    urlStr = input;
  } else if (input instanceof URL) {
    urlStr = input.toString();
  } else if (input && typeof input === 'object') {
    requestObj = input as Request;
    urlStr = requestObj.url;
  }
  
  if (urlStr.startsWith(supabaseUrl)) {
    const relativePath = urlStr.substring(supabaseUrl.length);
    // Use relative URL to ensure it hits the same origin as the app
    const proxyUrl = `/api/supabase-proxy?path=${encodeURIComponent(relativePath)}`;
    
    const newInit: RequestInit = { ...init };
    
    if (requestObj) {
      newInit.method = init?.method || requestObj.method;
      
      const mergedHeaders = new Headers();
      if (requestObj.headers) {
        requestObj.headers.forEach((value, key) => {
          mergedHeaders.set(key, value);
        });
      }
      if (init?.headers) {
        const initHeaders = new Headers(init.headers);
        initHeaders.forEach((value, key) => {
          mergedHeaders.set(key, value);
        });
      }
      newInit.headers = mergedHeaders;
      
      const method = (newInit.method || 'GET').toUpperCase();
      if (!['GET', 'HEAD'].includes(method)) {
        if (init?.body !== undefined) {
          newInit.body = init.body;
        } else {
          try {
            const clonedReq = requestObj.clone();
            newInit.body = await clonedReq.text();
          } catch (e) {
            console.warn("Could not extract body from request object:", e);
          }
        }
      }
    }
    
    try {
      const response = await fetch(proxyUrl, newInit);
      return response;
    } catch (err) {
      console.warn("Proxy fetch failed, falling back to direct fetch:", err);
      try {
        return await fetch(input, init);
      } catch (directErr) {
        console.warn("Direct fetch also failed, returning offline fallback response:", directErr);
        return new Response(JSON.stringify({ data: [], error: null, message: "Offline fallback" }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }
  }
  
  return fetch(input, init);
};

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    lock: async (name: string, acquireTimeout: number, fn: () => Promise<any>) => {
      return await fn();
    },
  },
  global: {
    fetch: customFetch,
  }
});
