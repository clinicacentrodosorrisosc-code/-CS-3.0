import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data } = await supabase.from('profiles').select('id').limit(1);
  if (data && data.length > 0) {
    const { error } = await supabase.from('profiles').update({ last_seen: new Date().toISOString() }).eq('id', data[0].id);
    console.log(error ? error.message : 'Success');
  } else {
    console.log('No profiles found');
  }
}
run();
