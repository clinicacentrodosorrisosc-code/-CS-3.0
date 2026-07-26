
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://dmslcvvjxfulsocksave.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtc2xjdnZqeGZ1bHNvY2tzYXZlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkzMDQyNjgsImV4cCI6MjA4NDg4MDI2OH0.H0iDEj58mdwSFnLlyn1a2n_k3UZBtf_rHH8w4BkzfUw';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTodayEvents() {
  const { data: tokensList } = await supabase.from('kommo_tokens').select('*');
  if (!tokensList || tokensList.length === 0) {
    console.log("No tokens found");
    return;
  }
  const tokens = tokensList[0];
  const subdomain = tokens.subdomain || 'centrodosorriso';
  const access_token = tokens.access_token;

  // Today is April 8th, 2026
  const todayStart = Math.floor(new Date(2026, 3, 8, 0, 0, 0).getTime() / 1000);
  const todayEnd = Math.floor(new Date(2026, 3, 8, 23, 59, 59).getTime() / 1000);

  console.log(`Checking events from ${new Date(todayStart * 1000).toISOString()} to ${new Date(todayEnd * 1000).toISOString()}`);

  const res = await fetch(`https://${subdomain}.kommo.com/api/v4/events?limit=100&filter[entity_type]=lead&filter[created_at][from]=${todayStart}&filter[created_at][to]=${todayEnd}`, {
    headers: { 'Authorization': `Bearer ${access_token}` }
  });

  if (res.status === 204) {
    console.log("No events found for today.");
    return;
  }

  const data = await res.json() as any;
  const events = data._embedded?.events || [];
  console.log(`Found ${events.length} events for today.`);

  const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });

  events.forEach((e: any) => {
    const date = new Date(e.created_at * 1000);
    console.log(`[${formatter.format(date)}] Type: ${e.type}, Lead ID: ${e.entity_id}`);
    if (e.value_after) {
        console.log(`  Value After: ${JSON.stringify(e.value_after)}`);
    }
  });
}

checkTodayEvents();
