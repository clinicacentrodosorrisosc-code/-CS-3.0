import fs from 'fs';
const file = 'src/crm/app/(dashboard)/inbox/page.tsx';
let content = fs.readFileSync(file, 'utf8');

const target = `      if (error) {
        // Supabase errors have non-enumerable properties — log fields
        // explicitly so the console message isn't just \`{}\`.
        console.error("Failed to hydrate conversation:", {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code,
        });
        return;
      }`;

const replacement = `      if (error) {
        if (
          (error.message?.includes("relation") && error.message?.includes("does not exist")) ||
          (error.message?.includes("Could not find the table") && error.message?.includes("schema cache"))
        ) {
          return;
        }
        // Supabase errors have non-enumerable properties — log fields
        // explicitly so the console message isn't just \`{}\`.
        console.error("Failed to hydrate conversation:", {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code,
        });
        return;
      }`;

if (content.includes(target)) {
  content = content.replace(target, replacement);
  fs.writeFileSync(file, content);
  console.log('Patched inbox/page.tsx');
} else {
  console.log('Target not found in inbox/page.tsx');
}
