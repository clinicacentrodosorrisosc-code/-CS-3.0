import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = 'https://dmslcvvjxfulsocksave.supabase.co';
// Tentar usar a chave anon mas com o RLS desabilitado via SQL no banco (se eu pudesse)
// Como não posso, vou tentar inserir usando a chave anon, mas talvez o erro seja outra coisa.
// O erro diz "new row violates row-level security policy", então a RLS está ativa.
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtc2xjdnZqeGZ1bHNvY2tzYXZlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkzMDQyNjgsImV4cCI6MjA4NDg4MDI2OH0.H0iDEj58mdwSFnLlyn1a2n_k3UZBtf_rHH8w4BkzfUw';

async function run() {
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  console.log("Verificando RLS...");
  
  const { data, error } = await supabase.from('kommo_tokens').select('*');
  
  if (error) {
    console.error("Erro ao buscar:", error);
  } else {
    console.log("Registros:", data);
  }
}

run();
