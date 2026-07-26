import fs from 'fs';
const file = 'src/crm/app/(dashboard)/pipelines/page.tsx';
let content = fs.readFileSync(file, 'utf8');

const target = `    if (error || !pipeline) {
      console.error("Failed to seed pipeline:", error?.message);
      return null;
    }`;

const replacement = `    if (error || !pipeline) {
      if (
        (error?.message?.includes("relation") && error?.message?.includes("does not exist")) ||
        (error?.message?.includes("Could not find the table") && error?.message?.includes("schema cache"))
      ) {
        return null;
      }
      console.error("Failed to seed pipeline:", error?.message);
      return null;
    }`;

if (content.includes(target)) {
  content = content.replace(target, replacement);
  fs.writeFileSync(file, content);
  console.log('Patched pipelines/page.tsx seed pipeline');
} else {
  console.log('Target not found in pipelines/page.tsx seed pipeline');
}
