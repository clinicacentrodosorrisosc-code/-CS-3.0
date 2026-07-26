import { supabase } from './src/supabaseClient';

async function test() {
  console.log("Testing profiles...");
  const { data: profile, error: pErr } = await supabase.from('profiles').select('*').limit(1);
  console.log("Profiles result:", { profile, pErr });

  console.log("Testing support_tickets...");
  const { data: tickets, error: tErr } = await supabase.from('support_tickets').select('*').limit(1);
  console.log("Support tickets result:", { tickets, tErr });
}

test();
