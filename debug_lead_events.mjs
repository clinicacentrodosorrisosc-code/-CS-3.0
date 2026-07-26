
import fetch from 'node-fetch';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://dmslcvvjxfulsocksave.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtc2xjdnZqeGZ1bHNvY2tzYXZlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkzMDQyNjgsImV4cCI6MjA4NDg4MDI2OH0.H0iDEj58mdwSFnLlyn1a2n_k3UZBtf_rHH8w4BkzfUw';
const supabase = createClient(supabaseUrl, supabaseKey);

async function debugLead() {
  const { data: tokensList, error: tokenError } = await supabase.from('kommo_tokens').select('*');
  if (tokenError) return console.error("Supabase Error:", tokenError);
  console.log("Tokens found:", tokensList.length);
  if (tokensList.length === 0) return console.error("No tokens found in table");
  const tokens = tokensList[0];

  const leadId = 36643029;
  const subdomain = tokens.subdomain || 'centrodosorriso';
  const access_token = tokens.access_token;

  console.log(`Checking lead ${leadId}...`);
  
  const lRes = await fetch(`https://${subdomain}.kommo.com/api/v4/leads/${leadId}?with=custom_fields_values`, {
    headers: { 'Authorization': `Bearer ${access_token}` }
  });
  const lead = await lRes.json();
  console.log("Lead Custom Fields:", JSON.stringify(lead.custom_fields_values, null, 2));

  console.log("Checking events...");
  const eRes = await fetch(`https://${subdomain}.kommo.com/api/v4/events?filter[entity_id]=${leadId}&filter[entity_type]=lead`, {
    headers: { 'Authorization': `Bearer ${access_token}` }
  });
  
  if (eRes.status === 204) return console.log("No events found");
  
  const eData = await eRes.json();
  const events = eData._embedded?.events || [];
  
  const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });

  events.forEach(e => {
    const date = new Date(e.created_at * 1000);
    console.log(`Event Type: ${e.type}, Date (SP): ${formatter.format(date)}, Raw: ${JSON.stringify(e)}`);
  });
}

debugLead();
