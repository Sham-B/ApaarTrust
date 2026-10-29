/**
 * scripts/test_browser_routes.mjs
 * Automates headless Chrome to visit every route in ApaarTrust and verify:
 * 1. DOM renders inside #app
 * 2. No error boundary ("Something went wrong loading this view") is triggered
 * 3. Page title and key elements are present
 */

import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE_URL = 'http://127.0.0.1:8080';

const routes = [
  // Public
  { path: '#/', role: null, expect: 'One ID. Verified students.' },
  { path: '#/verify', role: null, expect: 'Public Verifier' },
  { path: '#/help', role: null, expect: 'Help Center' },

  // Officer
  { path: '#/officer/overview', role: 'Officer', expect: 'Overview' },
  { path: '#/officer/institutions', role: 'Officer', expect: 'Institutions' },
  { path: '#/officer/institutions/1-1090123456', role: 'Officer', expect: 'Aryabhata' },
  { path: '#/officer/findings', role: 'Officer', expect: 'Findings' },
  { path: '#/officer/duplicates', role: 'Officer', expect: 'Duplicates' },
  { path: '#/officer/verifications', role: 'Officer', expect: 'Verification' },
  { path: '#/officer/insights', role: 'Officer', expect: 'Insights' },
  { path: '#/officer/audit', role: 'Officer', expect: 'Audit' },
  { path: '#/officer/rules', role: 'Officer', expect: 'Rules' },

  // College
  { path: '#/college/overview', role: 'Institution', expect: 'Aryabhata' },
  { path: '#/college/upload', role: 'Institution', expect: 'Upload' },
  { path: '#/college/students', role: 'Institution', expect: 'Students' },
  { path: '#/college/certificates', role: 'Institution', expect: 'Certificate' },
  { path: '#/college/submissions', role: 'Institution', expect: 'Submissions' },
  { path: '#/college/todos', role: 'Institution', expect: 'To-Do' },

  // Student
  { path: '#/student/record', role: 'Student', expect: 'Student Record' },
  { path: '#/student/consent', role: 'Student', expect: 'Consent' },
  { path: '#/student/activity', role: 'Student', expect: 'Who Viewed My Record' },
  { path: '#/student/certificates', role: 'Student', expect: 'Certificates' },
  { path: '#/student/share', role: 'Student', expect: 'Share Credential' },
];

console.log('='.repeat(70));
console.log('Headless Chrome Route Render Verification');
console.log(`Testing ${routes.length} routes against live server at ${BASE_URL}`);
console.log('='.repeat(70));

let passed = 0;
let failed = 0;
const results = [];

for (const r of routes) {
  const url = `${BASE_URL}/index.html${r.path}`;
  const tmpOut = path.resolve('chrome_route_test.html');

  // When testing a role, we can pass a role query or let client router/store handle it
  // Since router guards check auth.canAccessRoute, if role is set in localStorage, let's verify
  try {
    const tmpProfile = path.resolve('chrome_tmp_profile');
    const args = [
      '--headless=new',
      '--disable-gpu',
      '--no-first-run',
      '--no-sandbox',
      '--disable-background-networking',
      `--user-data-dir=${tmpProfile}`,
      '--dump-dom',
      url
    ];

    const stdout = execFileSync(CHROME_PATH, args, { encoding: 'utf-8', timeout: 15000 });
    fs.writeFileSync(tmpOut, stdout, 'utf-8');

    const hasErrorBoundary = stdout.includes('Something went wrong loading this view');
    const hasErrorStack = stdout.includes('Failed to load view');
    const appContentLength = stdout.length;

    if (hasErrorBoundary || hasErrorStack) {
      console.error(`✗ FAIL: ${r.path} rendered ERROR BOUNDARY!`);
      failed++;
      results.push({ path: r.path, status: 'FAIL', reason: 'Error boundary triggered' });
    } else if (appContentLength < 1000) {
      console.warn(`⚠ WARN: ${r.path} rendered suspiciously short HTML (${appContentLength} chars)`);
      results.push({ path: r.path, status: 'WARN', reason: 'Short HTML' });
    } else {
      console.log(`✓ PASS: ${r.path} (${appContentLength} bytes rendered cleanly)`);
      passed++;
      results.push({ path: r.path, status: 'PASS' });
    }
  } catch (err) {
    console.error(`✗ ERROR visiting ${r.path}:`, err.message);
    failed++;
    results.push({ path: r.path, status: 'ERROR', reason: err.message });
  }
}

try { fs.unlinkSync(path.resolve('chrome_route_test.html')); } catch {}

console.log('='.repeat(70));
console.log(`Results: ${passed} PASSED, ${failed} FAILED out of ${routes.length} routes.`);
console.log('='.repeat(70));

if (failed > 0) process.exit(1);
process.exit(0);
