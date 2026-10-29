/**
 * College Submissions & Diff History Page
 */

import { api } from '../api.js';
import { store } from '../store.js';
import { renderAppShell } from '../ui/AppShell.js';
import { renderStatusPill } from '../ui/StatusPill.js';
import { renderEmptyState } from '../ui/EmptyState.js';
import { openModal } from '../ui/Modal.js';
import { showToast } from '../ui/Toast.js';
import { h } from '../ui/h.js';

export async function renderCollegeSubmissions(container) {
  const { persona } = store.getState();
  const instId = persona?.institution_id || '1-1090123456';

  let instData = null;
  let loading = true;
  let errorMsg = null;

  try {
    instData = await api.getInstitution(instId);
    loading = false;
  } catch (err) {
    loading = false;
    errorMsg = err.message || 'Failed to load submission history';
  }

  const submissions = instData?.submissions || [];

  const contentHtml = `
    <div class="page-container">
      <div class="page-header">
        <div class="page-header-title">
          <h1>Submission Batches & Version History</h1>
          <p class="page-header-subtitle">
            Audited student batches committed to ApaarTrust. Every batch creates an immutable version with automatic change diffing.
          </p>
        </div>
        <div class="page-header-actions">
          <a href="#/college/upload" class="btn btn-primary">
            <svg class="icon"><use href="vendor/lucide-sprite.svg#upload-cloud"></use></svg>
            Upload New Batch
          </a>
        </div>
      </div>

      ${errorMsg ? `
        <div class="toast toast-error" style="position: static; margin-bottom: 24px;">
          <svg class="icon"><use href="vendor/lucide-sprite.svg#alert-triangle"></use></svg>
          <div class="toast-content"><div class="toast-title">Error</div><div class="toast-message">${errorMsg}</div></div>
        </div>
      ` : ''}

      ${submissions.length === 0 ? renderEmptyState({
        iconName: 'file-text',
        title: 'No submissions yet',
        description: 'You have not committed any student intake batches for this academic year.',
        actionHtml: '<a href="#/college/upload" class="btn btn-primary">Upload your first batch</a>'
      }) : `
        <div class="card" style="padding: 0; overflow: hidden; margin-bottom: 32px;">
          <div style="padding: 16px 20px; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center; background: var(--bg-surface-elevated);">
            <div style="display: flex; align-items: center; gap: 8px;">
              <svg class="icon" style="color: var(--primary);"><use href="vendor/lucide-sprite.svg#history"></use></svg>
              <strong>Audited Submissions Log (${submissions.length} versions)</strong>
            </div>
            <span class="badge">Academic Year: 2024-25</span>
          </div>

          <div class="table-container">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Version</th>
                  <th>Status</th>
                  <th>Submitted At</th>
                  <th>Filename</th>
                  <th>Total Rows</th>
                  <th>Valid Rows</th>
                  <th>Flagged</th>
                  <th style="text-align: right;">Actions</th>
                </tr>
              </thead>
              <tbody>
                ${submissions.map(sub => {
                  const dateStr = sub.committed_at || sub.created_at || 'Just now';
                  const formattedDate = dateStr.includes('T') ? new Date(dateStr).toLocaleString() : dateStr;
                  return `
                    <tr>
                      <td>
                        <strong style="color: var(--primary); font-size: 15px;">v${sub.version}</strong>
                        <div style="font-size: 11px; font-family: monospace; color: var(--text-muted);">${sub.id}</div>
                      </td>
                      <td>
                        ${renderStatusPill({
                          status: sub.status === 'committed' ? 'valid' : 'pending',
                          label: sub.status === 'committed' ? 'Committed' : 'Pending'
                        })}
                      </td>
                      <td style="color: var(--text-muted); font-size: 13px;">
                        ${formattedDate}
                      </td>
                      <td style="font-family: monospace; font-size: 13px;">
                        ${sub.filename || 'student_intake.xlsx'}
                      </td>
                      <td><span class="tabular-nums">${sub.total_rows || 0}</span></td>
                      <td>
                        <span class="tabular-nums" style="color: var(--success); font-weight: 600;">
                          ${sub.valid_rows || (sub.total_rows - (sub.flagged_rows || 0))}
                        </span>
                      </td>
                      <td>
                        <span class="tabular-nums" style="color: ${sub.flagged_rows > 0 ? 'var(--warning)' : 'var(--text-muted)'}; font-weight: 600;">
                          ${sub.flagged_rows || 0}
                        </span>
                      </td>
                      <td style="text-align: right;">
                        <div style="display: inline-flex; gap: 8px;">
                          <button class="btn btn-secondary btn-sm btn-view-receipt" data-sub-id="${sub.id}">
                            <svg class="icon"><use href="vendor/lucide-sprite.svg#shield-check"></use></svg>
                            Receipt
                          </button>
                          <button class="btn btn-secondary btn-sm btn-view-diff" data-sub-id="${sub.id}" data-version="${sub.version}">
                            <svg class="icon"><use href="vendor/lucide-sprite.svg#git-compare"></use></svg>
                            View Diff
                          </button>
                          <a href="/api/v1/submissions/${sub.id}/export-errors" download="errors_${sub.id}.csv" class="btn btn-ghost btn-sm" title="Export Findings CSV">
                            <svg class="icon"><use href="vendor/lucide-sprite.svg#download"></use></svg>
                            Errors
                          </a>
                        </div>
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `}

      <!-- Explanatory card -->
      <div class="card" style="background: var(--bg-surface-elevated); border-left: 4px solid var(--primary);">
        <h4 style="margin: 0 0 8px 0; display: flex; align-items: center; gap: 8px;">
          <svg class="icon" style="color: var(--primary);"><use href="vendor/lucide-sprite.svg#shield-check"></use></svg>
          Immutable Auditing & Continuous Versioning
        </h4>
        <p style="margin: 0; font-size: 13px; color: var(--text-muted); line-height: 1.6;">
          ApaarTrust enforces append-only version records. Re-uploading corrected spreadsheets creates a new version increment (e.g. v2, v3) without discarding past submissions. Every change in enrolment records is cryptographically chained and timestamped, ensuring AICTE compliance and transparent historical provenance.
        </p>
      </div>
    </div>
  `;

  renderAppShell(container, contentHtml, 'submissions');

  // Attach Diff button handlers
  const diffButtons = container.querySelectorAll('.btn-view-diff');
  diffButtons.forEach(btn => {
    btn.addEventListener('click', async () => {
      const subId = btn.dataset.subId;
      const version = btn.dataset.version;
      btn.disabled = true;
      btn.innerHTML = `<span class="spinner" style="width: 14px; height: 14px; border-width: 2px;"></span> Loading diff...`;

      try {
        const diffRes = await api.get(`/api/v1/submissions/${subId}/diff`);
        openDiffModal(subId, version, diffRes);
      } catch (err) {
        showToast({
          type: 'error',
          message: `Failed to load diff: ${err.message}`
        });
      } finally {
        btn.disabled = false;
        btn.innerHTML = `<svg class="icon"><use href="vendor/lucide-sprite.svg#git-compare"></use></svg> View Diff`;
      }
    });
  });

  // Attach Receipt button handlers
  const receiptButtons = container.querySelectorAll('.btn-view-receipt');
  receiptButtons.forEach(btn => {
    btn.addEventListener('click', async () => {
      const subId = btn.dataset.subId;
      btn.disabled = true;
      btn.innerHTML = `<span class="spinner" style="width: 14px; height: 14px; border-width: 2px;"></span> Loading...`;

      try {
        const receipt = await api.get(`/api/v1/submissions/${subId}/receipt`);
        openReceiptModal(receipt);
      } catch (err) {
        showToast({
          type: 'error',
          message: `Failed to load receipt: ${err.message}`
        });
      } finally {
        btn.disabled = false;
        btn.innerHTML = `<svg class="icon"><use href="vendor/lucide-sprite.svg#shield-check"></use></svg> Receipt`;
      }
    });
  });
}

function openReceiptModal(receipt) {
  const modalBody = `
    <div style="margin-bottom: 20px;">
      <div style="background: rgba(19, 136, 8, 0.08); border-left: 4px solid var(--success); padding: 12px 16px; border-radius: var(--radius-sm); margin-bottom: 20px;">
        <strong style="color: var(--success);">Cryptographic Batch Receipt Verified</strong>
        <div style="font-size: 12px; color: var(--text-muted); margin-top: 4px;">
          This submission has been immutably committed into the ApaarTrust registry with a SHA-256 batch digest.
        </div>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; font-size: 13px; margin-bottom: 20px;">
        <div><strong>Submission ID:</strong> <span style="font-family: monospace;">${receipt.submission_id}</span></div>
        <div><strong>Version:</strong> <span class="badge">v${receipt.version}</span></div>
        <div><strong>Institution ID:</strong> <span style="font-family: monospace;">${receipt.institution_id}</span></div>
        <div><strong>Status:</strong> <span class="badge badge-success">${receipt.status}</span></div>
        <div><strong>Total Rows:</strong> <span class="tabular-nums font-bold">${receipt.total_rows}</span></div>
        <div><strong>Valid Rows:</strong> <span class="tabular-nums font-bold" style="color: var(--success);">${receipt.valid_rows}</span></div>
        <div><strong>Flagged Rows:</strong> <span class="tabular-nums font-bold" style="color: var(--warning);">${receipt.flagged_rows}</span></div>
        <div><strong>Committed:</strong> <span style="font-size: 12px; color: var(--text-muted);">${receipt.committed_at}</span></div>
      </div>

      <div style="background: var(--bg-surface-elevated); padding: 12px; border-radius: var(--radius-sm); border: 1px solid var(--border-color);">
        <div style="font-size: 11px; text-transform: uppercase; font-weight: 700; color: var(--text-muted); margin-bottom: 6px;">
          SHA-256 Batch Receipt Digest
        </div>
        <div style="font-family: monospace; font-size: 12px; word-break: break-all; color: var(--primary);">
          ${receipt.receipt_hash_sha256}
        </div>
      </div>
    </div>
  `;

  openModal({
    title: `Submission Receipt: ${receipt.submission_id}`,
    bodyHtml: modalBody,
    actions: [
      {
        label: 'Close',
        variant: 'secondary',
        onClick: (close) => close(),
      },
      {
        label: 'View Students Roster',
        variant: 'primary',
        onClick: () => {
          window.location.hash = '#/college/students';
        }
      }
    ]
  });
}

function openDiffModal(subId, version, diff) {
  const addedCount = diff.added_students?.length || 0;
  const removedCount = diff.removed_students?.length || 0;
  const modifiedCount = diff.modified_students?.length || 0;
  const prevVersion = parseInt(version, 10) > 1 ? `v${parseInt(version, 10) - 1}` : 'baseline';

  const modalBody = `
    <div style="margin-bottom: 20px;">
      <div style="font-size: 13px; color: var(--text-muted); margin-bottom: 16px;">
        Comparing current submission <strong style="color: var(--primary);">v${version}</strong> against prior submission <strong style="color: var(--text-color);">${prevVersion}</strong>.
      </div>

      <!-- Stat Badges -->
      <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 24px;">
        <div style="background: rgba(19, 136, 8, 0.08); border: 1px solid rgba(19, 136, 8, 0.3); border-radius: var(--radius-md); padding: 12px; text-align: center;">
          <div style="font-size: 22px; font-weight: 700; color: var(--success);" class="tabular-nums">+${addedCount}</div>
          <div style="font-size: 12px; color: var(--text-muted); text-transform: uppercase;">Added Students</div>
        </div>
        <div style="background: rgba(198, 40, 40, 0.08); border: 1px solid rgba(198, 40, 40, 0.3); border-radius: var(--radius-md); padding: 12px; text-align: center;">
          <div style="font-size: 22px; font-weight: 700; color: var(--danger);" class="tabular-nums">-${removedCount}</div>
          <div style="font-size: 12px; color: var(--text-muted); text-transform: uppercase;">Removed Students</div>
        </div>
        <div style="background: rgba(232, 115, 26, 0.08); border: 1px solid rgba(232, 115, 26, 0.3); border-radius: var(--radius-md); padding: 12px; text-align: center;">
          <div style="font-size: 22px; font-weight: 700; color: var(--warning);" class="tabular-nums">~${modifiedCount}</div>
          <div style="font-size: 12px; color: var(--text-muted); text-transform: uppercase;">Modified Records</div>
        </div>
      </div>

      <!-- Detail breakdown -->
      ${addedCount > 0 ? `
        <h4 style="margin: 16px 0 8px 0; font-size: 14px; color: var(--success); display: flex; align-items: center; gap: 6px;">
          <svg class="icon"><use href="vendor/lucide-sprite.svg#plus-circle"></use></svg>
          Added Students (${addedCount})
        </h4>
        <div style="max-height: 160px; overflow-y: auto; border: 1px solid var(--border-color); border-radius: var(--radius-sm); margin-bottom: 16px;">
          <table class="data-table" style="font-size: 12px;">
            <thead>
              <tr>
                <th>Masked APAAR</th>
                <th>Name</th>
                <th>Programme</th>
                <th>Quota</th>
              </tr>
            </thead>
            <tbody>
              ${diff.added_students.map(s => `
                <tr>
                  <td style="font-family: monospace;">${s.apaar_masked || 'XXXXXXXX1234'}</td>
                  <td><strong>${s.name}</strong></td>
                  <td>${s.programme || '-'}</td>
                  <td><span class="badge">${s.admission_quota || '-'}</span></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      ` : ''}

      ${modifiedCount > 0 ? `
        <h4 style="margin: 16px 0 8px 0; font-size: 14px; color: var(--warning); display: flex; align-items: center; gap: 6px;">
          <svg class="icon"><use href="vendor/lucide-sprite.svg#edit-2"></use></svg>
          Modified Fields (${modifiedCount})
        </h4>
        <div style="max-height: 160px; overflow-y: auto; border: 1px solid var(--border-color); border-radius: var(--radius-sm); margin-bottom: 16px;">
          <table class="data-table" style="font-size: 12px;">
            <thead>
              <tr>
                <th>Masked APAAR</th>
                <th>Field</th>
                <th>Old Value</th>
                <th>New Value</th>
              </tr>
            </thead>
            <tbody>
              ${diff.modified_students.map(m => `
                <tr>
                  <td style="font-family: monospace;">${m.apaar_masked || '-'}</td>
                  <td><strong>${m.field || 'Enrolment'}</strong></td>
                  <td style="color: var(--danger); text-decoration: line-through;">${m.old_value || '-'}</td>
                  <td style="color: var(--success); font-weight: 600;">${m.new_value || '-'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      ` : ''}

      ${addedCount === 0 && removedCount === 0 && modifiedCount === 0 ? `
        <div style="text-align: center; padding: 24px; color: var(--text-muted); background: var(--bg-surface-elevated); border-radius: var(--radius-md);">
          No record differences detected compared to the baseline.
        </div>
      ` : ''}
    </div>
  `;

  openModal({
    title: `Submission Version Diff: v${version} (${subId})`,
    bodyHtml: modalBody,
    actions: [
      {
        label: 'Close',
        variant: 'secondary',
        onClick: (close) => close(),
      },
      {
        label: 'Export Errors CSV',
        variant: 'primary',
        onClick: () => {
          window.location.href = `/api/v1/submissions/${subId}/export-errors`;
        }
      }
    ]
  });
}
