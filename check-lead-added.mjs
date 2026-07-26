import fs from 'fs';
const text = fs.readFileSync('test.txt', 'utf8');
const lines = text.split('\n');
const leadAddedIndices = [];
lines.forEach((line, i) => {
  if (line.includes('"lead_added"')) {
    leadAddedIndices.push(i);
  }
});
if (leadAddedIndices.length > 0) {
  const firstIndex = leadAddedIndices[0];
  console.log(lines.slice(Math.max(0, firstIndex - 2), firstIndex + 20).join('\n'));
} else {
  console.log("No lead_added events found.");
}
