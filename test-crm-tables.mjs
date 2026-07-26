import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://dmslcvvjxfulsocksave.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtc2xjdnZqeGZ1bHNvY2tzYXZlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkzMDQyNjgsImV4cCI6MjA4NDg4MDI2OH0.H0iDEj58mdwSFnLlyn1a2n_k3UZBtf_rHH8w4BkzfUw';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTables() {
  console.log("Checking for CRM tables...");
  const { data, error } = await supabase.from('crm_funnels').select('id').limit(1);
  if (error) {
    console.log("Error or Missing Table:", error.message);
  } else {
    console.log("Table exists! Rows found:", data.length);
  }
}

checkTables();
