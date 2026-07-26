import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = 'https://dmslcvvjxfulsocksave.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtc2xjdnZqeGZ1bHNvY2tzYXZlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkzMDQyNjgsImV4cCI6MjA4NDg4MDI2OH0.H0iDEj58mdwSFnLlyn1a2n_k3UZBtf_rHH8w4BkzfUw';

async function run() {
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  // 1. Fetch data from /api/kommo/leads
  const response = await fetch('http://localhost:3000/api/kommo/leads?month=2026-04&full=true');
  const data = await response.json();
  
  if (!data.success) {
    console.error("Failed to fetch leads from Kommo API. Response:", JSON.stringify(data));
    return;
  }
  
  console.log("--- DADOS DO KOMMO (API) ---");
  console.log("Total Leads:", data.totalLeads);
  console.log("Leads Ana:", data.leadsAna);
  console.log("Leads Comercial:", data.leadsComercial);
  console.log("Agendados Ana (Total):", Object.values(data.dailyAgendadosAna || {}).reduce((a, b) => a + b, 0));
  console.log("Agendados Comercial (Total):", Object.values(data.dailyAgendadosComercial || {}).reduce((a, b) => a + b, 0));
  
  // 2. Fetch data from Supabase daily_evaluations
  const { data: evals, error } = await supabase.from('daily_evaluations').select('*');
  
  if (error) {
    console.error("Error fetching from daily_evaluations:", error);
    return;
  }
  
  console.log("\n--- DADOS DO SUPABASE (daily_evaluations) ---");
  const totalAnaScheduled = evals.reduce((acc, curr) => acc + (curr.ana_scheduled || 0), 0);
  const totalComScheduled = evals.reduce((acc, curr) => acc + (curr.com_scheduled || 0), 0);
  
  console.log("Total Agendados Ana:", totalAnaScheduled);
  console.log("Total Agendados Comercial:", totalComScheduled);
  
  // Compare
  console.log("\n--- COMPARAÇÃO ---");
  console.log("Ana (API vs DB):", Object.values(data.dailyAgendadosAna || {}).reduce((a, b) => a + b, 0), "vs", totalAnaScheduled);
  console.log("Comercial (API vs DB):", Object.values(data.dailyAgendadosComercial || {}).reduce((a, b) => a + b, 0), "vs", totalComScheduled);
}

run();
