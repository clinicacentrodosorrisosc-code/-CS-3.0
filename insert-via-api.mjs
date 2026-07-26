import fetch from 'node-fetch';

async function run() {
  console.log("Tentando inserir via API...");
  
  const response = await fetch('http://localhost:3000/api/kommo/manual-token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      subdomain: 'centrodosorriso',
      access_token: 'eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiIsImp0aSI6IjZkNTIzNGYxOTM2MTBkMGMyNGFlMDM3MzM4ZDBiN2Y3MWMwYmQxNmMxY2VmZmY2ZjQ2ZDIwNWUyNWU4MmM1NmFmM2MwYjkyZmMxNTU3MmQ3In0.eyJhdWQiOiJkMjdiOThkOS1lYmY4LTQwYzMtOTI2NC1kNjNlOWE0NjE1YjQiLCJqdGkiOiI2ZDUyMzRmMTkzNjEwZDBjMjRhZTAzNzMzOGQwYjdmNzFjMGJkMTZjMWNlZmZmNmY0NmQyMDVlMjVlODJjNTZhZjNjMGI5MmZjMTU1NzJkNyIsImlhdCI6MTc3NTc3ODU2MSwibmJmIjoxNzc1Nzc4NTYxLCJleHAiOjE4MDM3NzI4MDAsInN1YiI6IjE1MDM1MzA0IiwiZ3JhbnRfdHlwZSI6IiIsImFjY291bnRfaWQiOjM0NzkwMjU1LCJiYXNlX2RvbWFpbiI6ImtvbW1vLmNvbSIsInZlcnNpb24iOjIsInNjb3BlcyI6WyJwdXNoX25vdGlmaWNhdGlvbnMiLCJmaWxlcyIsImNybSIsImZpbGVzX2RlbGV0ZSIsIm5vdGlmaWNhdGlvbnMiXSwiaGFzaF91dWlkIjoiOTkxY2U0YTctYzhmNS00MjU5LTk0ZDgtMWM3NjNmZDE3YzYxIiwiYXBpX2RvbWFpbiI6ImFwaS1nLmtvbW1vLmNvbSJ9.mTcHqlj0JTGxkWJ6weRMf1ELfKcDanVvN8yFychKb-bdA0LmtBFox0E2bd5E2k5tZ-7S3xXHD90Cx5WgSlYfX_DSN2ERDPdKqDKGQnLbOP9KOqC-tgnoJjHFV3caGNFd4lPGz-jqUMboAAl6qxIQ65MfbwqKlV20SEnJODnYD8Q7fUHJ-R0UR1ZgHPcRQknP2V3xp0-JsUnKDO_7PTsO5SsfyQHq2_SW0yu9LNuPzMtLmvO2zdgb7lGu3OPaK3TGc-C9BHs5UlAZz3gTu1rcYm70By2l3-WZGysVV7uJ_4wA8JSM_5_C0bokJh33xc3QidyGgx3trMJ7ycHb6mAJjw',
      refresh_token: 'manual',
      client_id: 'd27b98d9-ebf8-40c3-9264-d63e9a4615b4',
      client_secret: 'manual',
      expires_in: 31536000
    })
  });
  
  const data = await response.json();
  console.log("Resposta da API:", data);
}

run();
