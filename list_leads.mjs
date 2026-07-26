import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://dmslcvvjxfulsocksave.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtc2xjdnZqeGZ1bHNvY2tzYXZlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkzMDQyNjgsImV4cCI6MjA4NDg4MDI2OH0.H0iDEj58mdwSFnLlyn1a2n_k3UZBtf_rHH8w4BkzfUw';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log("Listing leads...");
  const { data, error } = await supabase.from('leads').select('*').limit(50);
  if (data) {
    console.log(JSON.stringify(data, null, 2));
  }
}

run();
