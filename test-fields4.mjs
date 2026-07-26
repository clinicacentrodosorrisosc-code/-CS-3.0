import fetch from 'node-fetch';

async function checkFields() {
  const res = await fetch('http://localhost:3000/api/kommo/leads?month=2026-04&subdomain=clinicacentrodosorrisosc&full=true');
  const data = await res.json();
  console.log(data);
}

checkFields();
