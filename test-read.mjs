import { supabase } from './supabaseClient';

async function run() {
  const { data, error } = await supabase.from('transactions').select('*').eq('description', 'Teste de Inserção de Receita');
  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Result:', data);
  }
}

run();
