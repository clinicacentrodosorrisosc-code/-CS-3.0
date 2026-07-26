import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
  const response = await fetch('http://localhost:3000/api/kommo/leads?month=2026-04&full=true');
  const data = await response.json();
  
  console.log("Leads Ana (agendados):", Object.keys(data.dailyAgendadosAna || {}).length);
  console.log("Leads Comercial (agendados):", Object.keys(data.dailyAgendadosComercial || {}).length);
  console.log("Debug leads found:", data.debug.leadsFound);
  console.log("Debug leads Ana:", data.debug.leadsAna);
  console.log("Debug leads James:", data.debug.leadsJames);
  const nonAnaLeads = leads.filter(l => {
    const cf = l.custom_fields_values?.find(c => Number(c.field_id) === 1488761);
    return cf && cf.values?.some(v => !String(v.value).toLowerCase().includes('ana'));
  });
  
  if (nonAnaLeads.length > 0) {
    console.log("Sample non-Ana Vendedor value:", JSON.stringify(nonAnaLeads[0].custom_fields_values?.find(c => Number(c.field_id) === 1488761)));
  }
}

run();
