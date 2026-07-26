import { supabase } from './supabaseClient';

async function run() {
  const { data, error } = await supabase.from('transactions').insert({
    id: 'test_' + Math.random().toString(36).substring(2, 9),
    date: '2026-05-27',
    description: 'Teste de Inserção de Receita',
    amount: 150.00,
    category: 'Geral',
    type: 'income',
    status: 'Paid',
    payment_method: 'Dinheiro',
  });

  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Success:', data);
  }
}

run();
