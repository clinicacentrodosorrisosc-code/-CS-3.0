import fs from 'fs';
const file = 'src/crm/components/settings/whatsapp-config.tsx';
let content = fs.readFileSync(file, 'utf8');

const target = `      if (error) {
        console.error('Failed to load config row:', error);
      }`;

const replacement = `      if (error) {
        if (
          (error.message?.includes("relation") && error.message?.includes("does not exist")) ||
          (error.message?.includes("Could not find the table") && error.message?.includes("schema cache"))
        ) {
          // Ignore missing table during initial setup
        } else {
          console.error('Failed to load config row:', error);
        }
      }`;

if (content.includes(target)) {
  content = content.replace(target, replacement);
  fs.writeFileSync(file, content);
  console.log('Patched whatsapp-config.tsx');
} else {
  console.log('Target not found in whatsapp-config.tsx');
}
