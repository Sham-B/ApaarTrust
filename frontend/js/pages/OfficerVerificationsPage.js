/**
 * Officer Verification Activity Page
 * Displays verifications, certificate checks, and presentation queries
 */

import { api } from '../api.js';
import { renderAppShell, bindAppShellEvents } from '../ui/AppShell.js';
import { statusPill } from '../ui/StatusPill.js';
import { iconHtml } from '../ui/icons.js';

export async function renderOfficerVerifications(container) {
  let sampleLogs = [
    {
      id: 1,
      verifier: 'Public Verifier Gateway',
      purpose: 'Employment Background Check',
      disclosedCount: 4,
      studentName: 'Rohan Aditya Sharma',
      apaarMasked: 'XXXX-XXXX-1100',
      status: 'genuine',
      timestamp: new Date().toISOString(),
    },
    {
      id: 2,
      verifier: 'State Scholarship Directorate',
      purpose: 'Higher Education Grant Verification',
      disclosedCount: 5,
      studentName: 'Aarav Sharma',
      apaarMasked: 'XXXX-XXXX-0123',
      status: 'genuine',
      timestamp: new Date(Date.now() - 3600000 * 2).toISOString(),
    },
  ];

  const contentHtml = `
    <div class="page-header">
      <div class="page-header-text">
        <h1>Public Verification Activity</h1>
        <p>Real-time log of credential presentation verifications and QR code scans across national portals.</p>
      </div>
      <div class="page-actions">
        <a href="#/verify" class="btn btn-secondary btn-sm" target="_blank">
          ${iconHtml('external-link', 'icon-sm')} Open public verifier portal
        </a>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <div>
          <h3>Recent Verification Transactions</h3>
          <small>Zero sensitive attribute exposure logged</small>
        </div>
        <span class="status-pill status-good">Active Gateway</span>
      </div>

      <div class="card-body" style="padding: 0;">
        <table class="data-table">
          <thead>
            <tr>
              <th>Txn ID</th>
              <th>Verifier Entity</th>
              <th>Purpose Scoped</th>
              <th>Student Masked</th>
              <th>Disclosed Fields</th>
              <th>Result</th>
              <th>Time</th>
            </tr>
          </thead>
          <tbody>
            ${sampleLogs
              .map(
                (log) => `
              <tr>
                <td><span class="tabular font-mono">#TXN-${log.id}</span></td>
                <td><strong>${log.verifier}</strong></td>
                <td>${log.purpose}</td>
                <td>
                  <div>${log.studentName}</div>
                  <small style="color: var(--text-muted); font-family: var(--font-mono);">${log.apaarMasked}</small>
                </td>
                <td><span class="tabular font-medium">${log.disclosedCount} fields (Salted)</span></td>
                <td>${statusPill('good', 'Genuine Verified')}</td>
                <td><span class="tabular" style="font-size: 0.8rem; color: var(--text-muted);">${new Date(log.timestamp).toLocaleTimeString()}</span></td>
              </tr>
            `
              )
              .join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;

  const breadcrumbs = [
    { label: 'Overview', href: '#/officer/overview' },
    { label: 'Verification Activity', href: '#/officer/verifications' },
  ];

  container.innerHTML = renderAppShell(contentHtml, breadcrumbs);
  bindAppShellEvents();
}
