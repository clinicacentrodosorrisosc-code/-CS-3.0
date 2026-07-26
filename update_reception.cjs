const fs = require('fs');
let code = fs.readFileSync('src/components/ReceptionDailyReport.tsx', 'utf8');

// We'll rewrite the entire file since it's large and has many commercial-specific things.
// Actually, it's better to just generate a clean version for Reception.
