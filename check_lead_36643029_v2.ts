
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://dmslcvvjxfulsocksave.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtc2xjdnZqeGZ1bHNvY2tzYXZlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkzMDQyNjgsImV4cCI6MjA4NDg4MDI2OH0.H0iDEj58mdwSFnLlyn1a2n_k3UZBtf_rHH8w4BkzfUw';
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data: tokensList } = await supabase.from('kommo_tokens').select('*');
  if (!tokensList || tokensList.length === 0) {
    console.log("No tokens found");
    return;
  }
  const tokens = tokensList[0];

  const subdomain = tokens.subdomain || 'centrodosorriso';
  const leadId = 36643029;

  const res = await fetch(`https://${subdomain}.kommo.com/api/v4/leads/${leadId}?with=custom_fields_values`, {
    headers: { 'Authorization': `Bearer ${tokens.access_token}` }
  });

  if (!res.ok) {
    console.log("Error fetching lead:", await res.text());
    return;
  }

  const lead = await res.json() as any;
  console.log("Lead Name:", lead.name);
  
  const eRes = await fetch(`https://${subdomain}.kommo.com/api/v4/events?filter[entity_id]=${leadId}&filter[entity_type]=lead`, {
    headers: { 'Authorization': `Bearer ${tokens.access_token}` }
  });

  if (eRes.status === 204) {
    console.log("No events found");
  } else {
    const eData = await eRes.json() as any;
    const events = eData._embedded?.events || [];
    events.forEach((e: any) => {
        const date = new Date(e.created_at * 1000);
        console.log(`Event: ${e.type}, Date: ${date.toISOString()}, Value: ${JSON.stringify(e.value_after)}`);
    });
  }
}

check();
