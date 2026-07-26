import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://dmslcvvjxfulsocksave.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtc2xjdnZqeGZ1bHNvY2tzYXZlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkzMDQyNjgsImV4cCI6MjA4NDg4MDI2OH0.H0iDEj58mdwSFnLlyn1a2n_k3UZBtf_rHH8w4BkzfUw';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const searchMap = [
    { table: 'contacts', columns: ['name', 'email', 'phone'] },
    { table: 'deals', columns: ['title', 'notes'] },
    { table: 'tasks', columns: ['title', 'description'] },
    { table: 'lab_orders', columns: ['patient_name', 'details'] },
    { table: 'support_tickets', columns: ['title', 'description'] },
    { table: 'messages', columns: ['content_text'] },
    { table: 'meetings', columns: ['title', 'content'] },
    { table: 'commercial_reports', columns: ['main_challenges', 'opportunities'] }
  ];

  for (const item of searchMap) {
    console.log(`Searching in ${item.table}...`);
    for (const col of item.columns) {
      const { data, error } = await supabase.from(item.table).select('*').ilike(col, '%Verônica%');
      if (data && data.length > 0) {
        console.log(`FOUND in ${item.table} [${col}]:`, JSON.stringify(data, null, 2));
      }
    }
  }
}

run();
