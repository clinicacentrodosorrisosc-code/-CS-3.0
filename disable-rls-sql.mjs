import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = 'https://dmslcvvjxfulsocksave.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtc2xjdnZqeGZ1bHNvY2tzYXZlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkzMDQyNjgsImV4cCI6MjA4NDg4MDI2OH0.H0iDEj58mdwSFnLlyn1a2n_k3UZBtf_rHH8w4BkzfUw';

async function run() {
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  console.log("Verificando RLS via SQL (comando ALTER)...");
  
  const { data, error } = await supabase.rpc('execute_sql', {
    sql: 'ALTER TABLE public.kommo_tokens DISABLE ROW LEVEL SECURITY;'
  });
  
  if (error) {
    console.error("Erro ao executar:", error);
  } else {
    console.log("Sucesso:", data);
  }
}

run();
