import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = 'https://dmslcvvjxfulsocksave.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtc2xjdnZqeGZ1bHNvY2tzYXZlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkzMDQyNjgsImV4cCI6MjA4NDg4MDI2OH0.H0iDEj58mdwSFnLlyn1a2n_k3UZBtf_rHH8w4BkzfUw';

async function run() {
  const supabase = createClient(supabaseUrl, supabaseKey);
  const { data: evals, error } = await supabase.from('daily_evaluations').select('*').limit(10);
  
  if (error) {
    console.error("Error:", error);
    return;
  }
  
  console.log("Evaluations:", JSON.stringify(evals, null, 2));
}

run();
