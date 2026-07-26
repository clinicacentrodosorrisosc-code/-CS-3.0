import fs from 'fs';
const file = 'src/crm/app/(dashboard)/pipelines/page.tsx';
let content = fs.readFileSync(file, 'utf8');

const target = `    if (error) {
      console.error("Failed to load pipelines:", error.message);
      if (error.code === "42P01") {
        setErrorMessage("Tabelas de pipeline não encontradas no banco de dados. Execute o SQL de configuração para criar as tabelas necessárias.");
      }
      return [];
    }`;

const replacement = `    if (error) {
      if (error.code === "42P01" || (error.message && error.message.includes("schema cache"))) {
        setErrorMessage("Tabelas de pipeline não encontradas no banco de dados. Execute o SQL de configuração para criar as tabelas necessárias.");
      } else {
        console.error("Failed to load pipelines:", error.message);
      }
      return [];
    }`;

if (content.includes(target)) {
  content = content.replace(target, replacement);
  fs.writeFileSync(file, content);
  console.log('Patched pipelines/page.tsx');
} else {
  console.log('Target not found in pipelines/page.tsx');
}
