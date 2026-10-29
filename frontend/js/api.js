/**
 * API Client with automatic role context, idle guard, preview fixtures, and friendly error handling.
 */

import { store } from './store.js';
import { idleManager } from './idle.js';
import { previewManager } from './preview.js';
import { getFixture, getVerifierSampleResult } from './fixtures.js';

function getFullUrl(endpoint) {
  if (typeof window.apiUrl === 'function') {
    return window.apiUrl(endpoint);
  }
  const base = (window.APP_CONFIG && window.APP_CONFIG.API_BASE) || '';
  return `${base}${endpoint}`;
}

const apiGetCache = new Map();

async function request(endpoint, options = {}) {
  // 1. Idle & Page Visibility Guard
  if (idleManager.isRequestBlocked(options)) {
    const reason = idleManager.getBlockReason();
    const err = new Error(`Request paused to save free server hours (${reason})`);
    err.name = 'IdleBlockedError';
    throw err;
  }

  const method = (options.method || 'GET').toUpperCase();
  const state = store.getState();

  // 2. Explicit Preview Mode
  if (previewManager.isActive()) {
    if (method === 'GET') {
      const fixture = getFixture(endpoint, options, state);
      if (fixture !== null && fixture !== undefined) {
        return fixture;
      }
    } else {
      // Mutating method in preview mode
      // Exception: verify presentation for sample demo
      if (endpoint.includes('/api/v1/verify/presentation')) {
        let bodyObj = null;
        try {
          bodyObj = typeof options.body === 'string' ? JSON.parse(options.body) : options.body;
        } catch (e) {}

        if (bodyObj?.credential_id === 'cred-demo-aicte-2026' || endpoint.includes('Sample') || endpoint.includes('Genuine')) {
          const sampleResult = getVerifierSampleResult('genuine');
          if (sampleResult) return sampleResult;
        }
      }

      // Mutating actions show a friendly toast
      previewManager.notifyMutationBlocked();
      const err = new Error('Preview mode: start the live server to try this');
      err.status = 400;
      throw err;
    }
  }

  // 3. Live Request Flow
  const url = getFullUrl(endpoint);

  const headers = {
    Accept: 'application/json',
    ...(options.headers || {}),
  };

  const bearerToken = sessionStorage.getItem('apaar_token');
  if (bearerToken) {
    headers['Authorization'] = `Bearer ${bearerToken}`;
  }

  if (state.role) {
    headers['X-Role'] = state.role;
    headers['X-User-Role'] = state.role;
  }

  if (state.institutionId) {
    headers['X-Institution-Id'] = state.institutionId;
  }

  if (state.studentToken) {
    headers['X-Student-Token'] = state.studentToken;
  }

  const cacheKey = `${url}|${state.role}|${state.institutionId}|${state.studentToken}`;

  if (method === 'GET') {
    const cached = apiGetCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < 3000) {
      return JSON.parse(JSON.stringify(cached.data));
    }
  } else {
    apiGetCache.clear();
  }

  try {
    const response = await fetch(url, { ...options, headers });

    if (response.status === 403) {
      let detail = 'Access forbidden: you do not have permission for this action.';
      try {
        const errJson = await response.json();
        if (errJson.detail) detail = errJson.detail;
      } catch (e) {
        // fallback
      }

      window.dispatchEvent(
        new CustomEvent('apaar:toast', {
          detail: { type: 'error', message: detail },
        })
      );

      const err = new Error(detail);
      err.status = 403;
      throw err;
    }

    if (!response.ok) {
      let detail = `Request failed with status ${response.status}`;
      try {
        const errJson = await response.json();
        if (errJson.detail) detail = errJson.detail;
      } catch (e) {
        // fallback
      }
      const err = new Error(detail);
      err.status = response.status;
      throw err;
    }

    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const data = await response.json();
      if (method === 'GET') {
        apiGetCache.set(cacheKey, { timestamp: Date.now(), data });
      }
      return data;
    }
    return response;
  } catch (error) {
    // If backend is unreachable and this is a GET request, fall back to preview mode
    if (method === 'GET' && (error.name === 'TypeError' || error.message.includes('fetch') || error.message.includes('network'))) {
      const fixture = getFixture(endpoint, options, state);
      if (fixture !== null && fixture !== undefined) {
        if (!previewManager.isActive()) {
          previewManager.enable();
        }
        return fixture;
      }
    }

    console.error(`API request error [${options.method || 'GET'} ${endpoint}]:`, error);
    throw error;
  }
}

export const api = {
  get: (endpoint, options = {}) => request(endpoint, { method: 'GET', ...options }),

  post: (endpoint, data, options = {}) =>
    request(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
      body: JSON.stringify(data),
      ...options,
    }),

  postForm: (endpoint, formData, options = {}) =>
    request(endpoint, {
      method: 'POST',
      body: formData,
      ...options,
    }),

  getStudentRecord: (token) => request(`/api/v1/students/${token}/record`),
  getInstitution: (instId) => request(`/api/v1/institutions/${instId}`),
};
