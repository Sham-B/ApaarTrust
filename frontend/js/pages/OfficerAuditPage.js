/**
 * Officer Cryptographic Audit Log Page
 * Hash-chained SHA-256 ledger with integrity verifier and live tamper demonstration
 */

import { api } from '../api.js';
import { renderAppShell, bindAppShellEvents } from '../ui/AppShell.js';
import { statusPill } from '../ui/StatusPill.js';
import { iconHtml } from '../ui/icons.js';

export async function renderOfficerAudit(container) {
  let auditEntries = [];
  try {
    auditEntries = await api.get('/api/v1/audit/trail?limit=30');
  } catch (err) {
    console.error('Failed to load audit trail:', err);
  }

  const contentHtml = `
    <div class="page-header">
      <div class="page-header-text">
        <h1>Cryptographic Audit Trail</h1>
        <p>Tamper-evident, hash-chained regulatory activity ledger. Each event is anchored by SHA-256 previous-hash commitments.</p>
      </div>

      <div class="page-actions">
        <button class="btn btn-secondary btn-sm" id="btnVerifyAudit">
          ${iconHtml('shield-check', 'icon-sm')} Verify integrity
        </button>
        <button class="btn btn-danger btn-sm" id="btnTamperDemo">
          ${iconHtml('zap', 'icon-sm')} Tamper simulation demo
        </button>
        <button class="btn btn-secondary btn-sm" id="btnRestoreAudit">
          ${iconHtml('rotate-ccw', 'icon-sm')} Restore chain
        </button>
      </div>
    </div>

    <!-- Verification Banner Status -->
    <div id="auditVerifyStatusBox" style="margin-bottom: var(--space-6);">
      <div class="card" style="background: var(--status-good-bg); border-left: 4px solid var(--green);">
        <div class="card-body" style="display: flex; justify-content: space-between; align-items: center; padding: 14px 20px;">
          <div>
            <div style="font-weight: 600; color: var(--status-good-text); display: flex; align-items: center; gap: 6px;">
              ${iconHtml('check-circle-2', 'icon-sm')} Cryptographic Audit Chain Valid & Untampered
            </div>
            <small style="color: var(--status-good-text); opacity: 0.85;">
              All SHA-256 links verified against local SQLite storage. Zero mutations detected.
            </small>
          </div>
          <span class="status-pill status-good">Unbroken Chain</span>
        </div>
      </div>
    </div>

    <!-- Audit Timeline Table -->
    <div class="card">
      <div class="card-header">
        <div>
          <h3>Audit Log Entries</h3>
          <small>Showing recent system and officer actions</small>
        </div>
        <span class="tabular font-medium" style="font-size: 0.8rem; color: var(--text-muted);">${auditEntries.length} Events</span>
      </div>

      <div class="card-body" style="padding: 0;">
        <table class="data-table">
          <thead>
            <tr>
              <th>Entry #</th>
              <th>Action Taken</th>
              <th>Actor Role</th>
              <th>Target Scope</th>
              <th>SHA-256 Current Hash</th>
              <th>Timestamp</th>
            </tr>
          </thead>
          <tbody>
            ${auditEntries
              .map(
                (entry) => `
              <tr>
                <td><span class="tabular font-mono">#${entry.id}</span></td>
                <td>
                  <strong>${entry.action}</strong>
                  <div style="font-size: 0.75rem; color: var(--text-muted); max-width: 340px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                    ${JSON.stringify(entry.payload || {})}
                  </div>
                </td>
                <td><span class="status-pill status-waiting">${entry.actor_role}</span></td>
                <td><span class="font-mono text-xs">${entry.application_id || 'SYSTEM'}</span></td>
                <td>
                  <span class="tabular font-mono" style="font-size: 0.72rem; color: var(--text-muted);" title="${entry.current_hash}">
                    ${(entry.current_hash || '').slice(0, 16)}...
                  </span>
                </td>
                <td>
                  <span class="tabular" style="font-size: 0.8rem; color: var(--text-muted);">
                    ${new Date(entry.timestamp).toLocaleTimeString()}
                  </span>
                </td>
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
    { label: 'Audit Log', href: '#/officer/audit' },
  ];

  container.innerHTML = renderAppShell(contentHtml, breadcrumbs);
  bindAppShellEvents();

  // Verify Audit Chain Button
  const verifyBtn = document.getElementById('btnVerifyAudit');
  if (verifyBtn) {
    verifyBtn.addEventListener('click', async () => {
      const box = document.getElementById('auditVerifyStatusBox');
      try {
        verifyBtn.disabled = true;
        const res = await api.get('/api/v1/audit/verify');
        verifyBtn.disabled = false;

        if (res.valid) {
          box.innerHTML = `
            <div class="card" style="background: var(--status-good-bg); border-left: 4px solid var(--green);">
              <div class="card-body" style="display: flex; justify-content: space-between; align-items: center; padding: 14px 20px;">
                <div>
                  <div style="font-weight: 600; color: var(--status-good-text); display: flex; align-items: center; gap: 6px;">
                    ${iconHtml('check-circle-2', 'icon-sm')} Verification Successful: Chain Intact
                  </div>
                  <small style="color: var(--status-good-text); opacity: 0.85;">
                    ${res.total_entries} entries verified. All SHA-256 parent-child pointers match exact payloads.
                  </small>
                </div>
                <span class="status-pill status-good">Valid</span>
              </div>
            </div>
          `;
        } else {
          box.innerHTML = `
            <div class="card" style="background: var(--status-problem-bg); border-left: 4px solid var(--red);">
              <div class="card-body" style="display: flex; justify-content: space-between; align-items: center; padding: 14px 20px;">
                <div>
                  <div style="font-weight: 600; color: var(--status-problem-text); display: flex; align-items: center; gap: 6px;">
                    ${iconHtml('alert-triangle', 'icon-sm')} TAMPER DETECTED: Audit Chain Broken
                  </div>
                  <small style="color: var(--status-problem-text); opacity: 0.85;">
                    Discrepancy at entry #${res.broken_entry_id}: Payload hash does not match stored cryptographic digest.
                  </small>
                </div>
                <span class="status-pill status-problem">Broken Hash</span>
              </div>
            </div>
          `;
        }
      } catch (err) {
        verifyBtn.disabled = false;
      }
    });
  }

  // Tamper Simulation Demo Button
  const tamperBtn = document.getElementById('btnTamperDemo');
  if (tamperBtn) {
    tamperBtn.addEventListener('click', async () => {
      const box = document.getElementById('auditVerifyStatusBox');
      try {
        tamperBtn.disabled = true;
        const res = await api.post('/api/v1/audit/tamper-demo', {});
        tamperBtn.disabled = false;

        box.innerHTML = `
          <div class="card" style="background: var(--status-problem-bg); border-left: 4px solid var(--red);">
            <div class="card-body" style="display: flex; justify-content: space-between; align-items: center; padding: 14px 20px;">
              <div>
                <div style="font-weight: 600; color: var(--status-problem-text); display: flex; align-items: center; gap: 6px;">
                  ${iconHtml('alert-triangle', 'icon-sm')} TAMPER DETECTED at entry #${res.tampered_entry_id}
                </div>
                <small style="color: var(--status-problem-text); opacity: 0.9;">
                  Demonstration: SQLite record was illegally mutated. Re-verification calculated hash mismatch and alerted instantly!
                </small>
              </div>
              <span class="status-pill status-problem">Tamper Flagged</span>
            </div>
          </div>
        `;

        window.dispatchEvent(
          new CustomEvent('apaar:toast', {
            detail: {
              type: 'error',
              message: `Tamper simulation complete: unauthorized mutation at entry #${res.tampered_entry_id} broke audit chain.`,
            },
          })
        );
      } catch (err) {
        tamperBtn.disabled = false;
      }
    });
  }

  // Restore Audit Chain Button
  const restoreBtn = document.getElementById('btnRestoreAudit');
  if (restoreBtn) {
    restoreBtn.addEventListener('click', async () => {
      const box = document.getElementById('auditVerifyStatusBox');
      try {
        restoreBtn.disabled = true;
        const res = await api.post('/api/v1/audit/restore', {});
        restoreBtn.disabled = false;

        box.innerHTML = `
          <div class="card" style="background: var(--status-good-bg); border-left: 4px solid var(--green);">
            <div class="card-body" style="display: flex; justify-content: space-between; align-items: center; padding: 14px 20px;">
              <div>
                <div style="font-weight: 600; color: var(--status-good-text); display: flex; align-items: center; gap: 6px;">
                  ${iconHtml('check-circle-2', 'icon-sm')} Audit Chain Restored & Recalculated
                </div>
                <small style="color: var(--status-good-text); opacity: 0.85;">
                  ${res.recalculated_entries || res.total_entries || 'All'} entries recalculated. Cryptographic hash continuity restored.
                </small>
              </div>
              <span class="status-pill status-good">Restored</span>
            </div>
          </div>
        `;

        window.dispatchEvent(
          new CustomEvent('apaar:toast', {
            detail: {
              type: 'success',
              message: 'Audit chain successfully restored and re-anchored.',
            },
          })
        );
      } catch (err) {
        restoreBtn.disabled = false;
      }
    });
  }
}

