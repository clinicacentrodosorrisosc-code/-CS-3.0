import { createClient } from '@supabase/supabase-js';
const supabase = createClient('https://dmslcvvjxfulsocksave.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtc2xjdnZqeGZ1bHNvY2tzYXZlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkzMDQyNjgsImV4cCI6MjA4NDg4MDI2OH0.H0iDEj58mdwSFnLlyn1a2n_k3UZBtf_rHH8w4BkzfUw');

async function run() {
  const { data, error } = await supabase.rpc('get_tables');
  console.log('Error:', error);
  console.log('Data:', data);
}
run();
