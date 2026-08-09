
import { supabase } from './src/supabaseClient';

async function check() {
  const { data: tokens } = await supabase.from('kommo_tokens').select('*').single();
  if (!tokens) {
    console.log("No tokens found");
    return;
  }

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
  console.log("Custom Fields:", JSON.stringify(lead.custom_fields_values, null, 2));

  const eRes = await fetch(`https://${subdomain}.kommo.com/api/v4/events?filter[entity_id]=${leadId}&filter[entity_type]=lead`, {
    headers: { 'Authorization': `Bearer ${tokens.access_token}` }
  });

  if (eRes.status === 204) {
    console.log("No events found");
  } else {
    const eData = await eRes.json() as any;
    console.log("Events:", JSON.stringify(eData._embedded?.events, null, 2));
  }
}

check();
