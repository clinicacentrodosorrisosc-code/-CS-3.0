import fs from 'fs';
import { globSync } from 'glob';

const files = globSync('src/**/*.tsx').concat(globSync('src/**/*.ts'));

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  let changed = false;
  
  const matches = [...content.matchAll(/console\.error\("Failed to fetch (.*?):", error\);/g)];
  for (const match of matches) {
    const target = match[0];
    const replacement = `if (
      (error.message?.includes("relation") && error.message?.includes("does not exist")) ||
      (error.message?.includes("Could not find the table") && error.message?.includes("schema cache"))
    ) {
      // Ignore missing table during initial setup
    } else {
      ${target}
    }`;
    content = content.replace(target, replacement);
    changed = true;
  }
  
  if (changed) {
    fs.writeFileSync(file, content);
    console.log('Patched', file);
  }
}
