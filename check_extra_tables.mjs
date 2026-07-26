import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://dmslcvvjxfulsocksave.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtc2xjdnZqeGZ1bHNvY2tzYXZlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkzMDQyNjgsImV4cCI6MjA4NDg4MDI2OH0.H0iDEj58mdwSFnLlyn1a2n_k3UZBtf_rHH8w4BkzfUw';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data, error } = await supabase.from('profiles').select('*').limit(1);
  if (error) {
    console.log("Error:", error);
  } else {
    // We can't list tables directly via PostgREST usually.
    // But we can check if a table exists by querying it.
    const potentialTables = ['leads', 'patients', 'appointments', 'events'];
    for (const t of potentialTables) {
      const { error: e } = await supabase.from(t).select('*').limit(1);
      if (!e) {
        console.log(`Table exists: ${t}`);
      }
    }
  }
}
run();
