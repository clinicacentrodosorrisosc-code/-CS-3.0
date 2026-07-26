import fs from 'fs';
const text = fs.readFileSync('sample-event.json', 'utf8');
console.log(text);
