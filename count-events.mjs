import fs from 'fs';
const text = fs.readFileSync('test.txt', 'utf8');
const lines = text.split('\n');
const counts = {};
lines.forEach(line => {
  const match = line.match(/"(.*)"/);
  if (match) {
    const type = match[1];
    if (type.startsWith('custom_field')) {
      counts[type] = (counts[type] || 0) + 1;
    }
  }
});
console.log(counts);
