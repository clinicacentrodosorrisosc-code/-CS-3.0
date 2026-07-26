import { supabase } from './supabaseClient.js';
async function run() {
  const { data, error } = await supabase.from('transactions').select('*').order('created_at', { ascending: false }).limit(5);
  console.log(data);
}
run();
