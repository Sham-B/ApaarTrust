/**
 * Client-Side Fixture Adapter for Preview Mode
 * Provides instant responses from recorded fixtures when server is off.
 */

import { FIXTURES } from './fixtures_data.js';

function deepClone(obj) {
  if (!obj) return obj;
  return JSON.parse(JSON.stringify(obj));
}

export function getFixture(endpoint, options = {}, state = {}) {
  const cleanEndpoint = (endpoint || '').split('?')[0];
  const queryStr = (endpoint || '').includes('?') ? (endpoint || '').split('?')[1] : '';

  // Health probe in preview
  if (cleanEndpoint === '/health' || cleanEndpoint === '/api/status') {
    return {
      status: 'ok',
      ready: true,
      demo_mode: true,
      stage: 'preview',
      seeded_count: 1166,
      institutions_count: 5,
    };
  }

  // Current role context
  if (cleanEndpoint === '/api/v1/me') {
    const role = state.role || (options.headers && options.headers['X-Role']);
    if (role === 'Officer') return deepClone(FIXTURES.me_officer);
    if (role === 'Institution') return deepClone(FIXTURES.me_institution);
    if (role === 'Student') return deepClone(FIXTURES.me_student);
    return deepClone(FIXTURES.me_public);
  }

  // Notifications
  if (cleanEndpoint === '/api/v1/notifications') {
    return deepClone(FIXTURES.notifications);
  }

  // Officer Overview
  if (cleanEndpoint === '/api/v1/officer/sparklines') {
    return deepClone(FIXTURES.officer_sparklines);
  }
  if (cleanEndpoint === '/api/v1/officer/state-map') {
    return deepClone(FIXTURES.officer_state_map);
  }

  // Institutions List & Details
  if (cleanEndpoint === '/api/v1/institutions') {
    return deepClone(FIXTURES.institutions);
  }
  const instStudentsMatch = cleanEndpoint.match(/^\/api\/v1\/institutions\/([^/]+)\/students$/);
  if (instStudentsMatch) {
    const instId = instStudentsMatch[1];
    const key = `institution_students_${instId}`;
    return deepClone(FIXTURES[key] || FIXTURES['institution_students_1-1090123456'] || []);
  }
  const instDetailMatch = cleanEndpoint.match(/^\/api\/v1\/institutions\/([^/]+)$/);
  if (instDetailMatch) {
    const instId = instDetailMatch[1];
    const key = `institution_${instId}`;
    return deepClone(FIXTURES[key] || FIXTURES['institution_1-1090123456']);
  }

  // Officer Findings
  if (cleanEndpoint === '/api/v1/officer/findings') {
    return deepClone(FIXTURES.officer_findings);
  }

  // Duplicates
  if (cleanEndpoint === '/api/v1/officer/duplicates') {
    return deepClone(FIXTURES.officer_duplicates);
  }

  // Audit Log & Verification
  if (cleanEndpoint === '/api/v1/audit/trail') {
    return deepClone(FIXTURES.audit_trail);
  }
  if (cleanEndpoint === '/api/v1/audit/verify') {
    return deepClone(FIXTURES.audit_verify);
  }

  // College Endpoints
  if (cleanEndpoint === '/api/v1/college/overview') {
    return deepClone(FIXTURES.college_overview);
  }
  if (cleanEndpoint === '/api/v1/college/todos') {
    return deepClone(FIXTURES.college_todos);
  }

  // Student Endpoints
  if (cleanEndpoint.startsWith('/api/v1/students/') && cleanEndpoint.endsWith('/record')) {
    return deepClone(FIXTURES.student_record);
  }
  if (cleanEndpoint.startsWith('/api/v1/students/') && cleanEndpoint.endsWith('/consent')) {
    return deepClone(FIXTURES.student_consent);
  }
  if (cleanEndpoint.startsWith('/api/v1/students/') && cleanEndpoint.endsWith('/access-log')) {
    return deepClone(FIXTURES.student_access_log);
  }

  // Credentials & Presentation
  if (cleanEndpoint.startsWith('/api/v1/credentials/') && cleanEndpoint.includes('/presentation')) {
    return deepClone(FIXTURES.student_presentation);
  }

  // Fallbacks
  return null;
}

export function getVerifierSampleResult(sampleKey) {
  const map = {
    genuine: FIXTURES.verify_result_genuine,
    revoked: FIXTURES.verify_result_revoked,
    expired: FIXTURES.verify_result_expired,
    tampered: FIXTURES.verify_result_tampered,
    not_found: FIXTURES.verify_result_not_found,
  };
  return deepClone(map[sampleKey] || null);
}

export function queryKnowledgeBaseClientSide(rawQuery, role = 'Public') {
  const query = (rawQuery || '').trim().toLowerCase();
  const entries = Array.isArray(FIXTURES.knowledge_base) ? FIXTURES.knowledge_base : [];

  const defaultSuggestions = [
    'Which institutions are over intake?',
    'What is the maximum approved intake for CSE?',
    'How does verification work?',
    'How is student privacy protected?',
  ];

  if (!entries.length) {
    return {
      found: false,
      answer: 'The assistant needs the live server',
      suggestions: defaultSuggestions,
    };
  }

  // Clean words for matching
  const queryWords = query
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter((w) => w.length > 2);

  let bestMatch = null;
  let bestScore = 0;

  for (const entry of entries) {
    let score = 0;
    const qLower = (entry.question || '').toLowerCase();
    const ansLower = (entry.answer || '').toLowerCase();
    const syns = Array.isArray(entry.synonyms) ? entry.synonyms.map((s) => s.toLowerCase()) : [];

    // Exact question match
    if (qLower === query) score += 50;
    if (qLower.includes(query)) score += 30;

    // Synonym match
    for (const syn of syns) {
      if (query.includes(syn) || syn.includes(query)) {
        score += 25;
      }
    }

    // Word matches
    for (const word of queryWords) {
      if (qLower.includes(word)) score += 5;
      if (syns.some((s) => s.includes(word))) score += 4;
      if (ansLower.includes(word)) score += 1;
    }

    if (score > bestScore) {
      bestScore = score;
      bestMatch = entry;
    }
  }

  if (bestMatch && bestScore >= 6) {
    return {
      found: true,
      answer: bestMatch.answer,
      rule_source: bestMatch.file_key || 'knowledge_base.yaml',
      engine: 'client-side preview knowledge index',
      actions: bestMatch.action_url
        ? [
            {
              label: bestMatch.action_label || 'View',
              href: bestMatch.action_url,
              tour_target: bestMatch.tour_target,
            },
          ]
        : [],
      suggestions: defaultSuggestions,
    };
  }

  return {
    found: false,
    answer: 'The assistant needs the live server',
    suggestions: defaultSuggestions,
  };
}

