/**
 * Student Who Viewed My Record / Access Activity Page
 */

import { api } from '../api.js';
import { store } from '../store.js';
import { renderAppShell } from '../ui/AppShell.js';
import { renderStatusPill } from '../ui/StatusPill.js';
import { renderEmptyState } from '../ui/EmptyState.js';

export async function renderStudentActivity(container) {
  const { persona } = store.getState();
  const token = persona?.student_token || 'tok_rohan_sharma';

  let logs = [];
  let loading = true;
  let errorMsg = null;

  try {
    logs = await api.get(`/api/v1/students/${token}/access-log`);
    loading = false;
  } catch (err) {
    loading = false;
    errorMsg = err.message || 'Failed to load access logs';
  }

  const contentHtml = `
    <div class="page-container">
      <div class="page-header">
        <div class="page-header-title">
          <h1>Who Viewed My Record</h1>
          <p class="page-header-subtitle">
            Immutable log of every third-party verification attempt. You have full transparency over when, by whom, and what fields were accessed.
          </p>
        </div>
      </div>

      ${errorMsg ? `
        <div class="toast toast-error" style="position: static; margin-bottom: 24px;">
          <svg class="icon"><use href="vendor/lucide-sprite.svg#alert-triangle"></use></svg>
          <div class="toast-content"><div class="toast-title">Error</div><div class="toast-message">${errorMsg}</div></div>
        </div>
      ` : ''}

      <!-- Reassurance callout -->
      <div class="card" style="background: var(--bg-surface-elevated); border-left: 4px solid var(--success); margin-bottom: 32px;">
        <div style="display: flex; gap: 12px; align-items: center;">
          <svg class="icon" style="color: var(--success);"><use href="vendor/lucide-sprite.svg#shield-check"></use></svg>
          <div style="font-size: 13px; color: var(--text-color); line-height: 1.5;">
            <strong>Zero Secret Queries:</strong> In accordance with India’s Digital Personal Data Protection (DPDP) principles, no organization can inspect your academic credentials without generating an audited log entry linked directly to your consent token.
          </div>
        </div>
      </div>

      ${logs.length === 0 ? renderEmptyState({
        iconName: 'activity',
        title: 'No verification activity recorded yet',
        description: 'No third-party verifier has verified your credential presentations yet. Activity will appear here automatically when employers or agencies verify your credentials.',
        actionHtml: '<a href="#/student/share" class="btn btn-primary">Share your credential</a>'
      }) : `
        <div style="display: flex; flex-direction: column; gap: 16px;">
          ${logs.map(log => {
            const isGenuine = log.status === 'genuine';
            const isRevoked = log.status === 'revoked';
            const dateStr = log.timestamp ? new Date(log.timestamp).toLocaleString() : 'Recent';

            return `
              <div class="card" style="padding: 20px; border-left: 4px solid ${isGenuine ? 'var(--success)' : isRevoked ? 'var(--danger)' : 'var(--warning)'};">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
                  <div>
                    <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 4px;">
                      <strong style="font-size: 16px; color: var(--text-color);">${log.verifier_type || 'External Verifier'}</strong>
                      ${renderStatusPill({
                        status: isGenuine ? 'valid' : isRevoked ? 'invalid' : 'pending',
                        label: isGenuine ? 'Verified Genuine' : isRevoked ? 'Blocked (Revoked)' : (log.status || 'Verified')
                      })}
                    </div>
                    <div style="font-size: 12px; color: var(--text-muted);">
                      Purpose: <strong style="color: var(--text-color);">${log.purpose || 'Credential Verification'}</strong> &bull; ${dateStr}
                    </div>
                  </div>
                  <div style="text-align: right; font-family: monospace; font-size: 11px; color: var(--text-muted);">
                    Tx: ${log.id || 'tx_log'}
                  </div>
                </div>

                <!-- Disclosed vs Withheld Summary -->
                <div style="background: var(--bg-surface-elevated); border-radius: var(--radius-sm); padding: 12px 16px; display: grid; grid-template-columns: 1fr 1fr; gap: 16px; font-size: 12px;">
                  <div>
                    <div style="color: var(--success); font-weight: 600; margin-bottom: 4px; display: flex; align-items: center; gap: 6px;">
                      <svg class="icon"><use href="vendor/lucide-sprite.svg#check"></use></svg>
                      Disclosed Fields (${log.disclosed_fields?.length || 0}):
                    </div>
                    <div style="color: var(--text-muted);">
                      ${log.disclosed_fields && log.disclosed_fields.length > 0 ? log.disclosed_fields.join(', ') : 'None'}
                    </div>
                  </div>

                  <div>
                    <div style="color: var(--text-muted); font-weight: 600; margin-bottom: 4px; display: flex; align-items: center; gap: 6px;">
                      <svg class="icon"><use href="vendor/lucide-sprite.svg#lock"></use></svg>
                      Withheld Fields (${log.withheld_fields?.length || 0}):
                    </div>
                    <div style="color: var(--text-muted);">
                      ${log.withheld_fields && log.withheld_fields.length > 0 ? log.withheld_fields.join(', ') : 'None'}
                    </div>
                  </div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `}
    </div>
  `;

  renderAppShell(container, contentHtml, 'activity');
}
