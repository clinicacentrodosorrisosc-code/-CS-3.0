import fetch from 'node-fetch';

async function check() {
  const res = await fetch('http://localhost:3000/api/kommo/leads?month=4&year=2026&subdomain=clinicacentrodosorrisosc&full=true');
  const data = await res.json();
  
  console.log(Object.keys(data));
  if (data.error) console.log(data.error);
}

check();
