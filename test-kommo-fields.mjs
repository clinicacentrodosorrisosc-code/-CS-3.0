import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';
import fs from 'fs';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = 'https://dmslcvvjxfulsocksave.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtc2xjdnZqeGZ1bHNvY2tzYXZlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkzMDQyNjgsImV4cCI6MjA4NDg4MDI2OH0.H0iDEj58mdwSFnLlyn1a2n_k3UZBtf_rHH8w4BkzfUw';

async function run() {
  const supabase = createClient(supabaseUrl, supabaseKey);
  const { data: tokens } = await supabase.from('kommo_tokens').select('*').single();
  
  if (!tokens) return console.log("No tokens");
  
  const subdomain = tokens.subdomain || 'centrodosorriso';
  
  const response = await fetch(`https://${subdomain}.kommo.com/api/v4/leads?limit=50&with=custom_fields_values`, {
    headers: { 'Authorization': `Bearer ${tokens.access_token}` }
  });
  
  const data = await response.json();
  const leads = data._embedded?.leads || [];
  
  const usersRes = await fetch(`https://${subdomain}.kommo.com/api/v4/users`, {
    headers: { 'Authorization': `Bearer ${tokens.access_token}` }
  });
  const uData = await usersRes.json();
  const usersMap = new Map();
  (uData._embedded?.users || []).forEach(u => usersMap.set(u.id, u.name.toLowerCase()));

  let anaCount = 0;
  let comercialCount = 0;
  let defaultComercialCount = 0;
  const vendedorValues = new Set();

  leads.forEach(lead => {
    const respUserName = usersMap.get(lead.responsible_user_id) || '';
    let isAna = respUserName.includes('ana');
    let isComercial = respUserName.includes('comercial') || respUserName.includes('james');
    let foundInField = false;
    
    if (!isAna && !isComercial) {
      lead.custom_fields_values?.forEach(cf => {
        const fieldName = (cf.field_name || '').toLowerCase();
        if (fieldName.includes('vendedor') || fieldName.includes('respons') || fieldName.includes('atend') || cf.field_id === 1488761) {
          cf.values?.forEach(v => {
            const val = String(v.value || '').toLowerCase();
            vendedorValues.add(val);
            if (val.includes('ana')) { isAna = true; foundInField = true; }
            if (val.includes('comercial') || val.includes('james')) { isComercial = true; foundInField = true; }
          });
        }
      });
    }

    if (isAna) anaCount++;
    else if (isComercial) comercialCount++;
    else defaultComercialCount++;
  });
  
  console.log(`Ana: ${anaCount}, Comercial (explicit): ${comercialCount}, Comercial (default): ${defaultComercialCount}`);
  console.log("Vendedor values found:", Array.from(vendedorValues));
}

run();
