const fs = require('fs');
let code = fs.readFileSync('src/components/ReceptionDailyReport.tsx', 'utf8');

// replace some basic things
code = code.replace(/CommercialDailyReport/g, 'ReceptionDailyReport');
code = code.replace(/CommercialReportAnswers/g, 'ReceptionReportAnswers');

fs.writeFileSync('src/components/ReceptionDailyReport.tsx', code);
