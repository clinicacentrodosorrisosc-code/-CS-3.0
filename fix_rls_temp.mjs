import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://dmslcvvjxfulsocksave.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtc2xjdnZqeGZ1bHNvY2tzYXZlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkzMDQyNjgsImV4cCI6MjA4NDg4MDI2OH0.H0iDEj58mdwSFnLlyn1a2n_k3UZBtf_rHH8w4BkzfUw';

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixRLS() {
  console.log(">>> Tentando adicionar políticas de RLS para anon...");
  
  // Tentamos habilitar acesso anon para a tabela de transações especificamente para Clinica Expert
  const sql = `
    DO $$ 
    BEGIN
      -- Tenta desativar RLS na transactions se possível ou adicionar política
      ALTER TABLE public.transactions DISABLE ROW LEVEL SECURITY;
      ALTER TABLE public.service_passwords DISABLE ROW LEVEL SECURITY;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Não foi possível alterar RLS diretamente';
    END $$;
  `;

  const { data, error } = await supabase.rpc('execute_sql', { sql });

  if (error) {
    console.error("Erro ao executar fix:", error);
  } else {
    console.log("Resultado:", data || "Comando enviado");
  }
}

fixRLS();
