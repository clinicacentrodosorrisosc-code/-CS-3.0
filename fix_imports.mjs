import fs from 'fs';
import { globSync } from 'glob';

const files = globSync('src/**/*.tsx').concat(globSync('src/**/*.ts'));

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  let lines = content.split('\n');
  if (lines[0].startsWith('import * as React from "react";') && lines[1].startsWith('"use client"')) {
    let temp = lines[0];
    lines[0] = lines[1];
    lines[1] = temp;
    fs.writeFileSync(file, lines.join('\n'));
    console.log('Fixed', file);
  }
}
