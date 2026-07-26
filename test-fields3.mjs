import fetch from 'node-fetch';

async function checkFields() {
  const res = await fetch('http://localhost:3000/api/kommo/leads?month=4&year=2026&subdomain=clinicacentrodosorrisosc&full=true');
  const data = await res.json();
  
  console.log("Agendamento Fields:", data.debug?.agendamentoFieldIds);
  console.log("Daily Agendados Ana:", data.dailyAgendadosAna);
  console.log("Daily Agendados Comercial:", data.dailyAgendadosComercial);
}

checkFields();
