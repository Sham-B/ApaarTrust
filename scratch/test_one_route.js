import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const tmpProfile = path.resolve(`chrome_tmp_${Date.now()}`);

try {
  const stdout = execFileSync(CHROME_PATH, [
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-sandbox',
    `--user-data-dir=${tmpProfile}`,
    '--virtual-time-budget=1000',
    '--dump-dom',
    'http://127.0.0.1:8080/'
  ], { encoding: 'utf-8', timeout: 10000 });

  console.log('Success, length:', stdout.length);
  console.log('Contains ApaarTrust:', stdout.includes('ApaarTrust'));
} catch (err) {
  console.error('Error:', err.message);
} finally {
  try { fs.rmSync(tmpProfile, { recursive: true, force: true }); } catch (e) {}
}
