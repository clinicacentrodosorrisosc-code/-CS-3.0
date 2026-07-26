import fetch from 'node-fetch';
import fs from 'fs';

async function run() {
  const tokens = JSON.parse(fs.readFileSync('kommo-tokens-debug.json', 'utf8'));
  
  const subdomain = tokens.subdomain || 'centrodosorriso';
  // Wait, the access_token in the debug file is 'HIDDEN'.
  // I need to hit the local server to get the fields.
}
run();
