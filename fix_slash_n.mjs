import fs from 'fs';
['src/components/CommercialDailyReport.tsx', 'src/components/ReceptionDailyReport.tsx'].forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    content = content.replace(/\\n    const handleSave = async \(\) => {/g, '\n    const handleSave = async () => {');
    fs.writeFileSync(file, content);
});
console.log('Fixed \\n');
