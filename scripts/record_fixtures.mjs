/**
 * scripts/record_fixtures.mjs
 * Records deterministic GET responses from the running local backend into frontend/fixtures/*.json
 * Zero external dependencies (pure Node.js)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BASE_URL = process.env.API_BASE_URL || 'http://127.0.0.1:8080';
const FIXTURES_DIR = path.resolve(__dirname, '..', 'frontend', 'fixtures');
const BUNDLE_FILE = path.resolve(__dirname, '..', 'frontend', 'js', 'fixtures_data.js');
const KB_YAML_PATH = path.resolve(__dirname, '..', 'backend', 'knowledge', 'knowledge_base.yaml');

if (!fs.existsSync(FIXTURES_DIR)) {
  fs.mkdirSync(FIXTURES_DIR, { recursive: true });
}

async function fetchJson(endpoint, headers = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const res = await fetch(url, {
    headers: {
      Accept: 'application/json',
      ...headers,
    },
  });
  if (!res.ok) {
    throw new Error(`Failed GET ${endpoint}: ${res.status} ${res.statusText}`);
  }
  return await res.json();
}

function parseKnowledgeYaml(yamlText) {
  // Simple deterministic YAML parser for knowledge_base.yaml structure
  const entries = [];
  let currentEntry = null;

  const lines = yamlText.split('\n');
  for (let rawLine of lines) {
    const line = rawLine.trim();
    if (line.startsWith('- id:')) {
      if (currentEntry) entries.push(currentEntry);
      currentEntry = { id: line.replace('- id:', '').trim() };
    } else if (currentEntry) {
      if (line.startsWith('category:')) {
        currentEntry.category = line.replace('category:', '').trim().replace(/^['"]|['"]$/g, '');
      } else if (line.startsWith('roles:')) {
        const match = line.match(/roles:\s*\[(.*?)\]/);
        currentEntry.roles = match ? match[1].split(',').map((r) => r.trim()) : [];
      } else if (line.startsWith('question:')) {
        currentEntry.question = line.replace('question:', '').trim().replace(/^['"]|['"]$/g, '');
      } else if (line.startsWith('synonyms:')) {
        const match = line.match(/synonyms:\s*\[(.*?)\]/);
        currentEntry.synonyms = match ? match[1].split(',').map((s) => s.trim().replace(/^['"]|['"]$/g, '')) : [];
      } else if (line.startsWith('file_key:')) {
        currentEntry.file_key = line.replace('file_key:', '').trim().replace(/^['"]|['"]$/g, '');
      } else if (line.startsWith('answer:')) {
        currentEntry.answer = line.replace('answer:', '').trim().replace(/^['"]|['"]$/g, '');
      } else if (line.startsWith('action_url:')) {
        currentEntry.action_url = line.replace('action_url:', '').trim().replace(/^['"]|['"]$/g, '');
      } else if (line.startsWith('action_label:')) {
        currentEntry.action_label = line.replace('action_label:', '').trim().replace(/^['"]|['"]$/g, '');
      } else if (line.startsWith('tour_target:')) {
        currentEntry.tour_target = line.replace('tour_target:', '').trim().replace(/^['"]|['"]$/g, '');
      }
    }
  }
  if (currentEntry) entries.push(currentEntry);
  return entries;
}

async function main() {
  console.log('======================================================================');
  console.log('ApaarTrust Fixture Recorder');
  console.log(`Connecting to local backend at: ${BASE_URL}`);
  console.log(`Saving fixtures to: ${FIXTURES_DIR}`);
  console.log('======================================================================\n');

  // Verify backend health
  try {
    const health = await fetchJson('/health');
    console.log(`✓ Backend health verified: ready=${health.ready}, seeded_count=${health.seeded_count}`);
  } catch (err) {
    console.error('✗ Backend is not reachable at', BASE_URL);
    console.error('Please ensure backend is running before recording fixtures.');
    process.exit(1);
  }

  const recorded = {};

  async function record(key, filename, fetchFn) {
    try {
      const data = await fetchFn();
      recorded[key] = data;
      const targetPath = path.join(FIXTURES_DIR, filename);
      fs.writeFileSync(targetPath, JSON.stringify(data, null, 2), 'utf-8');
      console.log(`✓ [${key}] -> frontend/fixtures/${filename}`);
    } catch (err) {
      console.error(`✗ Error recording [${key}]: ${err.message}`);
    }
  }

  // 1. Roles & Profile (Me)
  await record('me_officer', 'me_officer.json', () =>
    fetchJson('/api/v1/me', { 'X-Role': 'Officer' })
  );
  await record('me_institution', 'me_institution.json', () =>
    fetchJson('/api/v1/me', { 'X-Role': 'Institution', 'X-Institution-Id': '1-1090123456' })
  );
  await record('me_student', 'me_student.json', () =>
    fetchJson('/api/v1/me', { 'X-Role': 'Student' })
  );
  await record('me_public', 'me_public.json', () =>
    fetchJson('/api/v1/me', {})
  );

  // 2. Notifications
  await record('notifications', 'notifications.json', () =>
    fetchJson('/api/v1/notifications', { 'X-Role': 'Officer' })
  );

  // 3. Officer Overview (Sparklines, State Map, Institutions)
  await record('officer_sparklines', 'officer_sparklines.json', () =>
    fetchJson('/api/v1/officer/sparklines', { 'X-Role': 'Officer' })
  );
  await record('officer_state_map', 'officer_state_map.json', () =>
    fetchJson('/api/v1/officer/state-map', { 'X-Role': 'Officer' })
  );
  await record('institutions', 'institutions.json', () =>
    fetchJson('/api/v1/institutions', { 'X-Role': 'Officer' })
  );

  // 4. Institution Details (All 5 Archetypes + aliases)
  const instList = recorded['institutions'] || [];
  const instIds = instList.map((i) => i.id);
  for (const id of instIds) {
    await record(`institution_${id}`, `institution_${id}.json`, () =>
      fetchJson(`/api/v1/institutions/${id}`, { 'X-Role': 'Officer' })
    );
    await record(`institution_students_${id}`, `institution_students_${id}.json`, () =>
      fetchJson(`/api/v1/institutions/${id}/students`, { 'X-Role': 'Officer' })
    );
  }

  // Alias 1-1090123458 (Bhaskara over-intake link in missions/landing)
  if (recorded['institution_1-1090234567']) {
    recorded['institution_1-1090123458'] = recorded['institution_1-1090234567'];
    fs.writeFileSync(
      path.join(FIXTURES_DIR, 'institution_1-1090123458.json'),
      JSON.stringify(recorded['institution_1-1090234567'], null, 2),
      'utf-8'
    );
    recorded['institution_students_1-1090123458'] = recorded['institution_students_1-1090234567'] || [];
    fs.writeFileSync(
      path.join(FIXTURES_DIR, 'institution_students_1-1090123458.json'),
      JSON.stringify(recorded['institution_students_1-1090123458'], null, 2),
      'utf-8'
    );
    console.log('✓ Aliased 1-1090123458 -> Bhaskara College (1-1090234567)');
  }

  // 5. Findings (Consolidated from institutions)
  const allFindings = [];
  for (const id of instIds) {
    const instData = recorded[`institution_${id}`];
    if (instData && Array.isArray(instData.findings)) {
      allFindings.push(...instData.findings);
    }
  }
  recorded['officer_findings'] = allFindings;
  fs.writeFileSync(path.join(FIXTURES_DIR, 'officer_findings.json'), JSON.stringify(allFindings, null, 2), 'utf-8');
  console.log(`✓ [officer_findings] -> frontend/fixtures/officer_findings.json (${allFindings.length} findings)`);

  // 6. Duplicates
  await record('officer_duplicates', 'officer_duplicates.json', () =>
    fetchJson('/api/v1/officer/duplicates', { 'X-Role': 'Officer' })
  );

  // 7. Audit Log Trail and Verification
  await record('audit_trail', 'audit_trail.json', () =>
    fetchJson('/api/v1/audit/trail?limit=30', { 'X-Role': 'Officer' })
  );
  await record('audit_verify', 'audit_verify.json', () =>
    fetchJson('/api/v1/audit/verify', { 'X-Role': 'Officer' })
  );

  // 8. College Overview, Students, Submissions, Todos
  const collegeOverview = {
    institution: recorded['institution_1-1090123456'],
    students_count: (recorded['institution_students_1-1090123456'] || []).length,
    recent_submissions: [
      {
        id: 'sub_demo_batch_001',
        batch_id: 'batch_ait_2024_01',
        programme: 'Computer Science and Engineering',
        academic_year: '2024-25',
        total_rows: 120,
        valid_rows: 115,
        flagged_rows: 5,
        status: 'committed',
        created_at: '2026-10-28T09:00:00Z',
      },
    ],
  };
  recorded['college_overview'] = collegeOverview;
  fs.writeFileSync(path.join(FIXTURES_DIR, 'college_overview.json'), JSON.stringify(collegeOverview, null, 2), 'utf-8');
  console.log(`✓ [college_overview] -> frontend/fixtures/college_overview.json`);

  recorded['college_students'] = recorded['institution_students_1-1090123456'] || [];
  fs.writeFileSync(path.join(FIXTURES_DIR, 'college_students.json'), JSON.stringify(recorded['college_students'], null, 2), 'utf-8');
  console.log(`✓ [college_students] -> frontend/fixtures/college_students.json`);

  const collegeTodos = [
    {
      id: 'todo_01',
      title: 'Upload Semester 1 Final Approved Roster',
      status: 'pending',
      due: '2026-11-15',
      priority: 'high',
    },
    {
      id: 'todo_02',
      title: 'Review EWS category documents for 3 candidates',
      status: 'completed',
      due: '2026-10-25',
      priority: 'medium',
    },
  ];
  recorded['college_todos'] = collegeTodos;
  fs.writeFileSync(path.join(FIXTURES_DIR, 'college_todos.json'), JSON.stringify(collegeTodos, null, 2), 'utf-8');
  console.log(`✓ [college_todos] -> frontend/fixtures/college_todos.json`);

  // 9. Student Record, Consent, Access Log
  const studentToken = '6279cb24d8c254201517a233c5af8cad3a75ce52cda4c3c8afa39eb20bafc506';
  await record('student_record', 'student_record.json', () =>
    fetchJson(`/api/v1/students/${studentToken}/record`)
  );
  await record('student_consent', 'student_consent.json', () =>
    fetchJson(`/api/v1/students/${studentToken}/consent`)
  );
  await record('student_access_log', 'student_access_log.json', () =>
    fetchJson(`/api/v1/students/${studentToken}/access-log`)
  );

  // 10. Verifier Sample Presentation & All 5 Verification Outcomes
  await record('student_presentation', 'student_presentation.json', () =>
    fetchJson('/api/v1/credentials/cred-demo-aicte-2026/presentation?purpose=Graduate%20Hiring')
  );

  // Outcome 1: Genuine
  const genuinePres = recorded['student_presentation'];
  const genuineRes = await fetch(`${BASE_URL}/api/v1/verify/presentation?verifier_type=Sample%20Genuine%20Demo`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(genuinePres),
  }).then((r) => r.json());
  await record('verify_result_genuine', 'verify_result_genuine.json', () => Promise.resolve(genuineRes));

  // Outcome 2: Revoked
  const revokedRes = {
    status: 'revoked',
    genuine: false,
    message: 'Student digital consent for this credential has been revoked or withdrawn pursuant to DPDP consent principles.',
    consent_status: 'REVOKED_BY_STUDENT',
    disclosed_fields: [],
    withheld_fields: ['name', 'programme', 'institution', 'dob', 'admission_quota', 'social_category'],
    what_to_do_next: 'Contact the candidate directly to request an active digital consent grant through the ApaarTrust Student Portal.',
  };
  await record('verify_result_revoked', 'verify_result_revoked.json', () => Promise.resolve(revokedRes));

  // Outcome 3: Expired
  const expiredRes = {
    status: 'expired',
    genuine: false,
    message: 'Credential validity window expired on 2024-06-30. Session credentials must be renewed annually.',
    disclosed_fields: [],
    withheld_fields: ['name', 'programme', 'institution', 'dob'],
    what_to_do_next: 'Request the candidate or issuing college registrar to issue an updated credential for the current academic session.',
  };
  await record('verify_result_expired', 'verify_result_expired.json', () => Promise.resolve(expiredRes));

  // Outcome 4: Tampered
  const tamperedRes = {
    status: 'tampered',
    genuine: false,
    message: 'Ed25519 cryptographic root signature mismatch! The presentation claims or commitment digest were illegally altered.',
    disclosed_fields: [],
    withheld_fields: [],
    what_to_do_next: 'DO NOT ACCEPT this credential. The cryptographic seal has been compromised. Report this finding to the AICTE Scrutiny Officer inbox.',
  };
  await record('verify_result_tampered', 'verify_result_tampered.json', () => Promise.resolve(tamperedRes));

  // Outcome 5: Not Found
  const notFoundRes = {
    status: 'not_found',
    genuine: false,
    message: 'Credential record not found in the AICTE ApaarTrust central registry.',
    disclosed_fields: [],
    withheld_fields: [],
    what_to_do_next: 'Confirm that the candidate has been formally admitted and that the institution has committed its intake batch.',
  };
  await record('verify_result_not_found', 'verify_result_not_found.json', () => Promise.resolve(notFoundRes));

  // 11. Assistant Knowledge Base (Bundled client-side)
  let kbEntries = [];
  if (fs.existsSync(KB_YAML_PATH)) {
    const yamlText = fs.readFileSync(KB_YAML_PATH, 'utf-8');
    kbEntries = parseKnowledgeYaml(yamlText);
  }
  recorded['knowledge_base'] = kbEntries;
  fs.writeFileSync(path.join(FIXTURES_DIR, 'knowledge_base.json'), JSON.stringify(kbEntries, null, 2), 'utf-8');
  console.log(`✓ [knowledge_base] -> frontend/fixtures/knowledge_base.json (${kbEntries.length} entries)`);

  // 12. Generate bundled JavaScript module: frontend/js/fixtures_data.js
  const bundleContent = `/**
 * Pre-recorded deterministic fixtures for Preview Mode (Zero server required)
 * Generated automatically by scripts/record_fixtures.mjs
 */
export const FIXTURES = ${JSON.stringify(recorded, null, 2)};
`;
  fs.writeFileSync(BUNDLE_FILE, bundleContent, 'utf-8');
  console.log(`\n✓ Bundled JavaScript module generated: ${BUNDLE_FILE}`);

  console.log('\n======================================================================');
  console.log(`All ${Object.keys(recorded).length} fixtures recorded successfully!`);
  console.log('======================================================================\n');
}

main().catch((err) => {
  console.error('Recording error:', err);
  process.exit(1);
});
