import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://dmslcvvjxfulsocksave.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtc2xjdnZqeGZ1bHNvY2tzYXZlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkzMDQyNjgsImV4cCI6MjA4NDg4MDI2OH0.H0iDEj58mdwSFnLlyn1a2n_k3UZBtf_rHH8w4BkzfUw';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log("Searching in tasks...");
  const { data: d1 } = await supabase.from('tasks').select('*').ilike('title', '%Verônica%');
  const { data: d2 } = await supabase.from('tasks').select('*').ilike('description', '%Verônica%');
  const combined = [...(d1 || []), ...(d2 || [])];
  if (combined.length > 0) {
    console.log("Found in tasks:", JSON.stringify(combined, null, 2));
  } else {
    console.log("Not found in tasks.");
  }
}

run();
