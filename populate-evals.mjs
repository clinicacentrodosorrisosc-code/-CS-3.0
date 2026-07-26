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
    console.error("Failed to fetch leads from Kommo API");
    return;
  }
  
  // 2. Prepare data for daily_evaluations
  const allDates = new Set([
    ...Object.keys(data.dailyAgendadosAna || {}),
    ...Object.keys(data.dailyAgendadosComercial || {}),
    ...Object.keys(data.dailyComparecidosAna || {}),
    ...Object.keys(data.dailyComparecidosComercial || {}),
    ...Object.keys(data.dailyFaltasAna || {}),
    ...Object.keys(data.dailyFaltasComercial || {})
  ]);
  
  const upsertData = Array.from(allDates).map(date => {
    return {
      date,
      ana_scheduled: data.dailyAgendadosAna?.[date] || 0,
      com_scheduled: data.dailyAgendadosComercial?.[date] || 0,
      ana_evaluated: data.dailyComparecidosAna?.[date] || 0,
      com_evaluated: data.dailyComparecidosComercial?.[date] || 0,
      ana_no_show: data.dailyFaltasAna?.[date] || 0,
      com_no_show: data.dailyFaltasComercial?.[date] || 0
    };
  });
  
  // 3. Upsert to daily_evaluations
  const { error } = await supabase.from('daily_evaluations').upsert(upsertData, { onConflict: 'date' });
  
  if (error) {
    console.error("Error upserting to daily_evaluations:", error);
  } else {
    console.log("Successfully populated daily_evaluations with", upsertData.length, "rows.");
  }
}

run();
