import { createClient } from "@supabase/supabase-js";

const supabaseUrl = 'https://dmslcvvjxfulsocksave.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtc2xjdnZqeGZ1bHNvY2tzYXZlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkzMDQyNjgsImV4cCI6MjA4NDg4MDI2OH0.H0iDEj58mdwSFnLlyn1a2n_k3UZBtf_rHH8w4BkzfUw';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log("Trying to fetch tokens directly with anon key...");
  
  const { data: tokens, error } = await supabase.from('kommo_tokens').select('*').single();
  if (error || !tokens) {
    console.error('Error fetching tokens:', error);
    return;
  }
  const { access_token, base_domain } = tokens;
  const subdomain = base_domain ? base_domain.split('.')[0] : tokens.subdomain;

  console.log(`Subdomain: ${subdomain}`);
  
  const response = await fetch(`https://${subdomain}.kommo.com/api/v4/leads/pipelines`, {
    headers: {
      'Authorization': `Bearer ${access_token}`,
      'Content-Type': 'application/json'
    }
  });
  
  if (!response.ok) {
    console.error(`Error fetching pipelines: ${response.status} ${response.statusText}`);
    const errText = await response.text();
    console.error(errText);
    return;
  }
  
  const data = await response.json();
  
  data._embedded.pipelines.forEach((p: any) => {
    console.log(`Pipeline: ${p.name} (ID: ${p.id})`);
    p._embedded.statuses.forEach((status: any) => {
      console.log(`  - [ID: ${status.id}] ${status.name}`);
    });
  });
}
run();
