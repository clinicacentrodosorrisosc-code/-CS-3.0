import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://dmslcvvjxfulsocksave.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtc2xjdnZqeGZ1bHNvY2tzYXZlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkzMDQyNjgsImV4cCI6MjA4NDg4MDI2OH0.H0iDEj58mdwSFnLlyn1a2n_k3UZBtf_rHH8w4BkzfUw';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log("Searching in lab_orders...");
  const { data, error } = await supabase.from('lab_orders').select('*').ilike('patient_name', '%Verônica%');
  if (data && data.length > 0) {
    console.log("Found in lab_orders:", JSON.stringify(data, null, 2));
  } else {
    console.log("Not found in lab_orders.");
  }
}

run();
