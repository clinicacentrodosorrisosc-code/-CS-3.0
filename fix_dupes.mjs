import fs from 'fs';
import { globSync } from 'glob';

const files = globSync('src/**/*.tsx').concat(globSync('src/**/*.ts'));

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  let lines = content.split('\n');
  if (lines[0].startsWith('import * as React from "react";') && lines[1] === '') {
    if (lines[2].startsWith('import * as React from "react"')) {
      lines.splice(0, 2);
      fs.writeFileSync(file, lines.join('\n'));
      console.log('Removed duplicate from', file);
    }
  } else if (lines[1] && lines[1].startsWith('import * as React from "react";') && lines[2] === '') {
    if (lines[3] && lines[3].startsWith('import * as React from "react"')) {
      lines.splice(1, 2);
      fs.writeFileSync(file, lines.join('\n'));
      console.log('Removed duplicate from', file);
    }
  }
}
