import fs from 'fs';
const file = 'src/crm/components/inbox/message-thread.tsx';
let content = fs.readFileSync(file, 'utf8');

const target = `        if (error) {
          console.error("Failed to fetch profiles:", error);
          return;
        }`;

const replacement = `        if (error) {
          if (
            (error.message?.includes("relation") && error.message?.includes("does not exist")) ||
            (error.message?.includes("Could not find the table") && error.message?.includes("schema cache"))
          ) {
            return;
          }
          console.error("Failed to fetch profiles:", error);
          return;
        }`;

if (content.includes(target)) {
  content = content.replace(target, replacement);
  fs.writeFileSync(file, content);
  console.log('Patched message-thread.tsx');
} else {
  console.log('Target not found in message-thread.tsx');
}
