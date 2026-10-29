/**
 * Officer Findings Inbox & Triage Board
 * Open, In Review, Resolved triage workflow with detail drawer
 */

import { api } from '../api.js';
import { renderAppShell, bindAppShellEvents } from '../ui/AppShell.js';
import { statusPill } from '../ui/StatusPill.js';
import { Drawer } from '../ui/Drawer.js';
import { iconHtml } from '../ui/icons.js';

export async function renderOfficerFindings(container) {
  let institutions = [];
  try {
    institutions = await api.get('/api/v1/institutions');
  } catch (err) {
    console.error('Failed to load findings context:', err);
  }

  // Aggregate all findings across institutions
  let allFindings = [];
  try {
    const detailPromises = institutions.map((inst) => api.get(`/api/v1/institutions/${inst.id}`));
    const details = await Promise.all(detailPromises);
    details.forEach((d) => {
      const instName = d.institution?.name;
      const instId = d.institution?.id;
      (d.findings || []).forEach((f) => {
        allFindings.push({ ...f, institution_name: instName, institution_id: instId });
      });
    });
  } catch (err) {
    console.error('Failed to aggregate findings:', err);
  }

  let activeTab = 'open'; // 'open', 'in_review', 'resolved'

  function renderView() {
    const filteredFindings = allFindings.filter((f) => (f.status || 'open').toLowerCase() === activeTab);

    const contentHtml = `
      <div class="page-header">
        <div class="page-header-text">
          <h1>Regulatory Findings Triage Inbox</h1>
          <p>National intake defects, seat-cap breaches, and concurrent duplicate enrolments requiring evaluation.</p>
        </div>
        <div class="page-actions">
          <span class="status-pill status-look">${allFindings.filter((f) => f.status === 'open').length} Open Attention Items</span>
        </div>
      </div>

      <!-- Triage Tabs -->
      <div style="display: flex; gap: var(--space-2); border-bottom: 1px solid var(--border-subtle); margin-bottom: var(--space-6);">
        <button class="btn btn-ghost btn-triage-tab ${activeTab === 'open' ? 'active' : ''}" data-status="open">
          Open (${allFindings.filter((f) => (f.status || 'open') === 'open').length})
        </button>
        <button class="btn btn-ghost btn-triage-tab ${activeTab === 'in_review' ? 'active' : ''}" data-status="in_review">
          In Review (${allFindings.filter((f) => f.status === 'in_review').length})
        </button>
        <button class="btn btn-ghost btn-triage-tab ${activeTab === 'resolved' ? 'active' : ''}" data-status="resolved">
          Resolved (${allFindings.filter((f) => f.status === 'resolved').length})
        </button>
      </div>

      <!-- Findings List -->
      <div class="card">
        <div class="card-body" style="padding: 0;">
          <table class="data-table">
            <thead>
              <tr>
                <th>Institution</th>
                <th>Rule ID</th>
                <th>Severity</th>
                <th>Explanation</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              ${
                filteredFindings.length > 0
                  ? filteredFindings
                      .map(
                        (f) => `
                  <tr>
                    <td>
                      <div style="font-weight: 600;">${f.institution_name}</div>
                      <small style="color: var(--text-muted); font-family: var(--font-mono);">${f.institution_id}</small>
                    </td>
                    <td><code>${f.rule_id}</code></td>
                    <td>${statusPill(f.severity === 'critical' ? 'problem' : f.severity === 'high' ? 'look' : 'waiting', f.severity.toUpperCase())}</td>
                    <td style="max-width: 420px;">${f.plain_reason}</td>
                    <td><span class="status-pill status-${f.status === 'resolved' ? 'good' : f.status === 'in_review' ? 'look' : 'waiting'}">${f.status || 'open'}</span></td>
                    <td>
                      <button class="btn btn-secondary btn-sm btn-inspect-finding" data-finding-id="${f.id}">
                        Inspect & Triage ${iconHtml('arrow-right', 'icon-sm')}
                      </button>
                    </td>
                  </tr>
                `
                      )
                      .join('')
                  : `
                  <tr>
                    <td colspan="6" style="text-align: center; padding: 40px; color: var(--text-muted);">
                      No findings currently in "${activeTab}" status.
                    </td>
                  </tr>
                `
              }
            </tbody>
          </table>
        </div>
      </div>
    `;

    const breadcrumbs = [
      { label: 'Overview', href: '#/officer/overview' },
      { label: 'Findings', href: '#/officer/findings' },
    ];

    container.innerHTML = renderAppShell(contentHtml, breadcrumbs);
    bindAppShellEvents();

    // Tab switching
    container.querySelectorAll('.btn-triage-tab').forEach((tab) => {
      tab.addEventListener('click', () => {
        activeTab = tab.dataset.status;
        renderView();
      });
    });

    // Inspect drawer handler
    container.querySelectorAll('.btn-inspect-finding').forEach((btn) => {
      btn.addEventListener('click', () => {
        const findingId = parseInt(btn.dataset.findingId, 10);
        const finding = allFindings.find((f) => f.id === findingId);
        if (finding) openFindingDrawer(finding);
      });
    });
  }

  function openFindingDrawer(finding) {
    const drawerContent = `
      <div style="display: flex; flex-direction: column; gap: var(--space-4);">
        <div>
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
            <span style="font-family: var(--font-mono); font-size: 0.85rem; color: var(--text-muted);">Rule: <code>${finding.rule_id}</code></span>
            ${statusPill(finding.severity === 'critical' ? 'problem' : 'look', finding.severity.toUpperCase())}
          </div>
          <h4>${finding.institution_name}</h4>
        </div>

        <div style="background: var(--bg-subtle); padding: var(--space-3); border-radius: var(--radius-sm); border-left: 3px solid var(--navy);">
          <strong>Plain Reason:</strong>
          <p style="margin-top: 4px; font-size: 0.88rem; color: var(--text-main);">${finding.plain_reason}</p>
        </div>

        <div>
          <strong>Benign Hypotheses & Context:</strong>
          <p style="font-size: 0.85rem; color: var(--text-muted); margin-top: 4px;">
            ${finding.benign_hypothesis || 'Student may have transitioned or submitted late cancellation documentation without updating regional records.'}
          </p>
        </div>

        <div>
          <strong>Fix Hint:</strong>
          <p style="font-size: 0.85rem; color: var(--text-muted); margin-top: 4px;">
            ${finding.fix_hint || 'Verify admission register against sanctioned Approval Process Handbook ceilings.'}
          </p>
        </div>

        <div>
          <strong>Evidence Attributes:</strong>
          <pre style="background: var(--bg-subtle); padding: 10px; border-radius: var(--radius-sm); font-size: 0.75rem; overflow-x: auto;">${JSON.stringify(finding.evidence || {}, null, 2)}</pre>
        </div>

        <div style="border-top: 1px solid var(--border-subtle); padding-top: var(--space-4); margin-top: var(--space-2);">
          <h4 style="margin-bottom: 8px;">Update Regulatory Triage Status</h4>
          <div class="form-group">
            <label class="form-label" for="triageReasonInput">Officer Written Justification (Min 10 characters):</label>
            <textarea id="triageReasonInput" class="form-textarea" rows="2" placeholder="e.g. Reviewed documentary proof with regional committee order #4401"></textarea>
            <div id="triageError" style="color: var(--red); font-size: 0.75rem; margin-top: 4px; display: none;"></div>
          </div>

          <div style="display: flex; gap: var(--space-2);">
            <button class="btn btn-secondary btn-sm btn-update-status" data-status="in_review">
              Move to In Review
            </button>
            <button class="btn btn-primary btn-sm btn-update-status" data-status="resolved">
              Mark Resolved
            </button>
          </div>
        </div>
      </div>
    `;

    const drawer = new Drawer({
      title: `Finding #${finding.id} Detail`,
      content: drawerContent,
      width: '500px',
    });

    drawer.open();

    const reasonInput = drawer.backdrop.querySelector('#triageReasonInput');
    const errorDiv = drawer.backdrop.querySelector('#triageError');

    drawer.backdrop.querySelectorAll('.btn-update-status').forEach((actionBtn) => {
      actionBtn.addEventListener('click', async () => {
        const nextStatus = actionBtn.dataset.status;
        const reason = reasonInput.value.trim();

        if (reason.length < 10) {
          errorDiv.textContent = 'A written justification of at least 10 characters is mandatory.';
          errorDiv.style.display = 'block';
          return;
        }

        try {
          actionBtn.disabled = true;
          await api.post(`/api/v1/findings/${finding.id}/status`, {
            status: nextStatus,
            reason: reason,
          });

          finding.status = nextStatus;
          drawer.close();

          window.dispatchEvent(
            new CustomEvent('apaar:toast', {
              detail: {
                type: 'success',
                message: `Finding #${finding.id} updated to ${nextStatus}. Audit event recorded.`,
              },
            })
          );

          renderView();
        } catch (err) {
          errorDiv.textContent = err.message || 'Failed to update status.';
          errorDiv.style.display = 'block';
          actionBtn.disabled = false;
        }
      });
    });
  }

  renderView();
}
