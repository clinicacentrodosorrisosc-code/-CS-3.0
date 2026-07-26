import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://dmslcvvjxfulsocksave.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtc2xjdnZqeGZ1bHNvY2tzYXZlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkzMDQyNjgsImV4cCI6MjA4NDg4MDI2OH0.H0iDEj58mdwSFnLlyn1a2n_k3UZBtf_rHH8w4BkzfUw';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const tables = [
    'transactions', 'sales_teams', 'dashboard_configs', 'accounts', 'daily_evaluations', 'profiles', 
    'contacts', 'tags', 'contact_tags', 'conversations', 'messages', 'whatsapp_config', 
    'pipelines', 'pipeline_stages', 'deals', 'message_reactions', 'message_templates', 
    'lab_prosthesis_types', 'lab_orders', 'lab_payments', 'support_tickets', 
    'service_passwords', 'kommo_tokens', 'meta_tokens', 'commercial_reports', 'commercial_settings', 'tasks', 'meetings'
  ];

  for (const table of tables) {
    try {
      const { data, error } = await supabase.from(table).select('*').limit(100);
      if (data) {
        const str = JSON.stringify(data);
        if (str.includes('Verônica')) {
          console.log(`FOUND in table ${table}`);
          console.log(JSON.stringify(data.filter(d => JSON.stringify(d).includes('Verônica')), null, 2));
        }
      }
    } catch (e) {
      // console.log(`Error or no table: ${table}`);
    }
  }
}

run();
