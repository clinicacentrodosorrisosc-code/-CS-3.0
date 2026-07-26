import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://dmslcvvjxfulsocksave.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtc2xjdnZqeGZ1bHNvY2tzYXZlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkzMDQyNjgsImV4cCI6MjA4NDg4MDI2OH0.H0iDEj58mdwSFnLlyn1a2n_k3UZBtf_rHH8w4BkzfUw';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data, error } = await supabase.rpc('get_tables'); // If this RPC exists
  if (error) {
     // Try manual query via REST if possible, but PostgREST doesn't usually allow direct access to information_schema unless mapped.
     // Let's try to just guess some more table names from the files.
     console.log("RPC failed, trying to guess tables from SQL files...");
  } else {
    console.log("Tables:", data);
  }
}
run();
