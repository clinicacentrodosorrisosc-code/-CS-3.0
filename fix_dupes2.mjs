import fs from 'fs';
import { globSync } from 'glob';

const files = globSync('src/**/*.tsx').concat(globSync('src/**/*.ts'));

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  let lines = content.split('\n');
  let changed = false;
  
  if (lines[0].startsWith('import * as React from "react";') && lines[1] && lines[1].startsWith('import * as React from "react"')) {
    lines.splice(0, 1);
    changed = true;
  } else if (lines[1] && lines[1].startsWith('import * as React from "react";') && lines[2] && lines[2].startsWith('import * as React from "react"')) {
    lines.splice(1, 1);
    changed = true;
  }
  
  if (changed) {
    fs.writeFileSync(file, lines.join('\n'));
    console.log('Removed duplicate from', file);
  }
}
