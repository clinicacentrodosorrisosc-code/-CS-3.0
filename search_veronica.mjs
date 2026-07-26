import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://dmslcvvjxfulsocksave.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtc2xjdnZqeGZ1bHNvY2tzYXZlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkzMDQyNjgsImV4cCI6MjA4NDg4MDI2OH0.H0iDEj58mdwSFnLlyn1a2n_k3UZBtf_rHH8w4BkzfUw';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const tables = ['leads', 'contacts', 'evaluations', 'tasks'];
  for (const table of tables) {
    console.log(`Searching in ${table}...`);
    try {
      const { data, error } = await supabase.from(table).select('*').ilike('name', '%Verônica%');
      if (data && data.length > 0) {
        console.log(`Found in ${table}:`, data);
      }
      
      // Also check content or title if applicable
      const { data: data2, error: error2 } = await supabase.from(table).select('*').ilike('title', '%Verônica%');
      if (data2 && data2.length > 0) {
        console.log(`Found in ${table} (title):`, data2);
      }
    } catch (e) {
      // Table might not exist
    }
  }
}

run();
