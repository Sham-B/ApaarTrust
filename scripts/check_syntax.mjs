import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      results = results.concat(walk(fullPath));
    } else if (file.endsWith('.js') || file.endsWith('.mjs')) {
      results.push(fullPath);
    }
  }
  return results;
}

const jsFiles = [...walk('frontend/js'), ...walk('scripts')];
let failed = 0;

for (const file of jsFiles) {
  try {
    execSync(`"${process.execPath}" --check "${file}"`, { stdio: 'pipe' });
  } catch (err) {
    console.error(`Syntax error in ${file}:`, err.message);
    failed++;
  }
}

if (failed === 0) {
  console.log(`✓ All ${jsFiles.length} JavaScript modules passed node --check with 0 syntax errors.`);
} else {
  console.error(`✗ ${failed} files failed syntax check.`);
  process.exit(1);
}
