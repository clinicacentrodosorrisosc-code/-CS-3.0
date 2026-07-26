
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://dmslcvvjxfulsocksave.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtc2xjdnZqeGZ1bHNvY2tzYXZlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkzMDQyNjgsImV4cCI6MjA4NDg4MDI2OH0.H0iDEj58mdwSFnLlyn1a2n_k3UZBtf_rHH8w4BkzfUw';
const supabase = createClient(supabaseUrl, supabaseKey);

async function listFields() {
  const { data: tokensList, error } = await supabase.from('kommo_tokens').select('*');
  if (error) {
    console.error("Supabase error:", error);
    return;
  }
  if (!tokensList || tokensList.length === 0) {
    console.log("No tokens found in Supabase");
    return;
  }
  const token = tokensList[0];
  console.log("Using token for subdomain:", token.subdomain);
  
  const res = await fetch(`https://${token.subdomain}.kommo.com/api/v4/leads/custom_fields`, {
    headers: { 'Authorization': `Bearer ${token.access_token}` }
  });
  if (!res.ok) {
    console.error("Kommo API error:", res.status, await res.text());
    return;
  }
  const data = await res.json() as any;
  const fields = data._embedded?.custom_fields || [];
  console.log("Fields found:", fields.length);
  console.log(JSON.stringify(fields.map((f: any) => ({ id: f.id, name: f.name })), null, 2));
}

listFields();
