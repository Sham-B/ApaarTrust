/**
 * Student Consent Ledger Page
 */

import { api } from '../api.js';
import { store } from '../store.js';
import { renderAppShell } from '../ui/AppShell.js';
import { renderStatusPill } from '../ui/StatusPill.js';
import { showToast } from '../ui/Toast.js';

export async function renderStudentConsent(container) {
  const { persona } = store.getState();
  const token = persona?.student_token || persona?.token || 'tok_rohan_sharma';

  let consentData = null;
  let loading = true;
  let errorMsg = null;

  try {
    consentData = await api.get(`/api/v1/students/${token}/consent`);
    loading = false;
  } catch (err) {
    loading = false;
    errorMsg = err.message || 'Failed to load consent ledger';
  }

  const grants = consentData?.grants || [];
  const availableFields = consentData?.available_fields || [
    { key: 'name', label: 'Full Name', sensitive: false },
    { key: 'programme', label: 'Degree & Programme', sensitive: false },
    { key: 'institution', label: 'Institution Name', sensitive: false },
    { key: 'enrolment_status', label: 'Enrolment Status (Active)', sensitive: false },
    { key: 'academic_year', label: 'Academic Year', sensitive: false },
    { key: 'dob', label: 'Date of Birth', sensitive: true },
    { key: 'gender', label: 'Gender', sensitive: true },
    { key: 'social_category', label: 'Affirmative Action / Social Category', sensitive: true }
  ];

  const activeGrants = grants.filter(g => !g.revoked_at);

  const contentHtml = `
    <div class="page-container">
      <div class="page-header">
        <div class="page-header-title">
          <h1>Consent Management Ledger</h1>
          <p class="page-header-subtitle">
            Sovereign field-level consent. Choose precisely which attributes third-party verifiers are permitted to view.
          </p>
        </div>
        <div class="page-header-actions">
          <button id="btn-revoke-all" class="btn btn-danger btn-sm" ${activeGrants.length === 0 ? 'disabled' : ''}>
            <svg class="icon"><use href="vendor/lucide-sprite.svg#shield-off"></use></svg>
            Revoke All Consent
          </button>
        </div>
      </div>

      ${errorMsg ? `
        <div class="toast toast-error" style="position: static; margin-bottom: 24px;">
          <svg class="icon"><use href="vendor/lucide-sprite.svg#alert-triangle"></use></svg>
          <div class="toast-content"><div class="toast-title">Error</div><div class="toast-message">${errorMsg}</div></div>
        </div>
      ` : ''}

      <!-- Plain Language Explainer Banner -->
      <div class="card" style="background: rgba(20, 48, 122, 0.04); border-left: 4px solid var(--primary); margin-bottom: 24px;">
        <div style="display: flex; gap: 12px; align-items: flex-start;">
          <svg class="icon" style="color: var(--primary); margin-top: 2px;"><use href="vendor/lucide-sprite.svg#eye-off"></use></svg>
          <div style="font-size: 13px; line-height: 1.6; color: var(--text-color);">
            <strong>Zero-Exposure Guarantee:</strong> When you withhold a field (such as Date of Birth or Social Category), our SD-JWT cryptographic engine generates a mathematical proof that your credential is genuine without disclosing the underlying value. Verifiers see only the fields you explicitly authorize below.
          </div>
        </div>
      </div>

      <!-- New Purpose Grant Creator -->
      <div class="card" style="margin-bottom: 32px;">
        <h3 style="margin: 0 0 16px 0; font-size: 16px; display: flex; align-items: center; gap: 8px;">
          <svg class="icon" style="color: var(--primary);"><use href="vendor/lucide-sprite.svg#plus-circle"></use></svg>
          Grant New Verification Consent
        </h3>

        <form id="form-grant-consent">
          <div class="grid grid-2" style="margin-bottom: 16px;">
            <div>
              <label style="display: block; font-size: 12px; font-weight: 600; text-transform: uppercase; margin-bottom: 6px; color: var(--text-muted);">
                Purpose of Verification
              </label>
              <input type="text" id="consent-purpose" class="input" placeholder="e.g., Campus Placement, Bank Education Loan, Scholarship" value="Public Verification" required />
            </div>
            <div>
              <label style="display: block; font-size: 12px; font-weight: 600; text-transform: uppercase; margin-bottom: 6px; color: var(--text-muted);">
                Consent Validity Window
              </label>
              <select id="consent-validity" class="select">
                <option value="30">30 Days</option>
                <option value="90" selected>90 Days (Recommended)</option>
                <option value="180">180 Days</option>
                <option value="365">1 Year</option>
              </select>
            </div>
          </div>

          <div style="margin-bottom: 20px;">
            <label style="display: block; font-size: 12px; font-weight: 600; text-transform: uppercase; margin-bottom: 10px; color: var(--text-muted);">
              Select Disclosed Fields
            </label>
            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 10px;">
              ${availableFields.map(f => {
                const defaultChecked = !f.sensitive;
                return `
                  <label class="card" style="padding: 10px 14px; margin: 0; display: flex; align-items: center; gap: 10px; cursor: pointer; border: 1px solid var(--border-color); background: var(--bg-surface-elevated);">
                    <input type="checkbox" name="disclosed_field" value="${f.key}" ${defaultChecked ? 'checked' : ''} class="consent-field-checkbox" data-label="${f.label}" />
                    <div style="flex: 1;">
                      <div style="font-size: 13px; font-weight: 600;">${f.label}</div>
                      ${f.sensitive ? '<span style="font-size: 10px; color: var(--warning); font-weight: 600; text-transform: uppercase;">Sensitive</span>' : '<span style="font-size: 10px; color: var(--text-muted);">Standard</span>'}
                    </div>
                  </label>
                `;
              }).join('')}
            </div>
          </div>

          <!-- Dynamic Live Preview Box -->
          <div id="consent-live-preview" style="background: var(--bg-surface-elevated); border: 1px dashed var(--border-color); border-radius: var(--radius-sm); padding: 14px; margin-bottom: 20px;">
            <div style="font-size: 12px; font-weight: 600; color: var(--text-muted); text-transform: uppercase; margin-bottom: 8px;">
              Verifier Visibility Preview
            </div>
            <div id="preview-visibility-text" style="font-size: 13px; line-height: 1.5;">
              Loading preview...
            </div>
          </div>

          <button type="submit" class="btn btn-primary">
            <svg class="icon"><use href="vendor/lucide-sprite.svg#check"></use></svg>
            Save & Grant Consent
          </button>
        </form>
      </div>

      <!-- Active & Historical Grants List -->
      <div class="card" style="padding: 0; overflow: hidden;">
        <div style="padding: 16px 20px; border-bottom: 1px solid var(--border-color); background: var(--bg-surface-elevated); display: flex; justify-content: space-between; align-items: center;">
          <div style="font-weight: 600; display: flex; align-items: center; gap: 8px;">
            <svg class="icon" style="color: var(--primary);"><use href="vendor/lucide-sprite.svg#list"></use></svg>
            Existing Consent Grants (${grants.length})
          </div>
          <span class="badge">${activeGrants.length} Active</span>
        </div>

        ${grants.length === 0 ? `
          <div style="padding: 32px; text-align: center; color: var(--text-muted);">
            No consent grants on record. Create one above to allow selective credential verification.
          </div>
        ` : `
          <div class="table-container">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Purpose</th>
                  <th>Status</th>
                  <th>Granted On</th>
                  <th>Expires On</th>
                  <th>Disclosed Fields</th>
                  <th style="text-align: right;">Action</th>
                </tr>
              </thead>
              <tbody>
                ${grants.map(g => {
                  const isRevoked = !!g.revoked_at;
                  const isExpired = new Date(g.expires_at) < new Date();
                  const statusType = isRevoked ? 'invalid' : isExpired ? 'pending' : 'valid';
                  const statusLabel = isRevoked ? 'Revoked' : isExpired ? 'Expired' : 'Active';

                  return `
                    <tr>
                      <td>
                        <strong>${g.purpose}</strong>
                        <div style="font-size: 11px; font-family: monospace; color: var(--text-muted);">${g.id}</div>
                      </td>
                      <td>
                        ${renderStatusPill({ status: statusType, label: statusLabel })}
                      </td>
                      <td style="font-size: 12px; color: var(--text-muted);">
                        ${new Date(g.created_at).toLocaleDateString()}
                      </td>
                      <td style="font-size: 12px; color: var(--text-muted);">
                        ${new Date(g.expires_at).toLocaleDateString()}
                      </td>
                      <td style="font-size: 12px;">
                        <span class="badge">${g.allowed_fields?.length || 0} fields</span>
                        <span style="color: var(--text-muted); margin-left: 4px;">(${g.allowed_fields?.join(', ') || 'none'})</span>
                      </td>
                      <td style="text-align: right;">
                        ${!isRevoked ? `
                          <button class="btn btn-danger btn-sm btn-revoke" data-grant-id="${g.id}">
                            <svg class="icon"><use href="vendor/lucide-sprite.svg#x-circle"></use></svg>
                            Revoke
                          </button>
                        ` : `
                          <span style="font-size: 12px; color: var(--text-muted);">Withdrawn</span>
                        `}
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        `}
      </div>
    </div>
  `;

  renderAppShell(container, contentHtml, 'consent');

  // Update dynamic preview
  const form = container.querySelector('#form-grant-consent');
  const previewDiv = container.querySelector('#preview-visibility-text');

  const updatePreview = () => {
    if (!previewDiv) return;
    const checked = Array.from(container.querySelectorAll('.consent-field-checkbox:checked')).map(cb => cb.dataset.label);
    const unchecked = Array.from(container.querySelectorAll('.consent-field-checkbox:not(:checked)')).map(cb => cb.dataset.label);

    previewDiv.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 4px;">
        <div style="color: var(--success); display: flex; align-items: center; gap: 6px;">
          <svg class="icon"><use href="vendor/lucide-sprite.svg#check-circle-2"></use></svg>
          <strong>Verifier CAN see:</strong> ${checked.length > 0 ? checked.join(', ') : 'Nothing'}
        </div>
        <div style="color: var(--text-muted); display: flex; align-items: center; gap: 6px;">
          <svg class="icon"><use href="vendor/lucide-sprite.svg#lock"></use></svg>
          <strong>Verifier CANNOT see (Withheld):</strong> ${unchecked.length > 0 ? unchecked.join(', ') : 'None (all fields disclosed)'}
        </div>
      </div>
    `;
  };

  container.querySelectorAll('.consent-field-checkbox').forEach(cb => {
    cb.addEventListener('change', updatePreview);
  });
  updatePreview();

  // Form submit
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const purpose = container.querySelector('#consent-purpose').value.trim();
      const validityDays = parseInt(container.querySelector('#consent-validity').value, 10);
      const allowedFields = Array.from(container.querySelectorAll('.consent-field-checkbox:checked')).map(cb => cb.value);

      try {
        await api.post(`/api/v1/students/${token}/consent`, {
          purpose,
          validity_days: validityDays,
          allowed_fields: allowedFields,
        });

        showToast({
          type: 'success',
          message: `Consent grant created for '${purpose}'.`,
        });

        // Re-render page
        renderStudentConsent(container);
      } catch (err) {
        showToast({
          type: 'error',
          message: `Failed to save consent: ${err.message}`,
        });
      }
    });
  }

  // Revoke single grant
  container.querySelectorAll('.btn-revoke').forEach(btn => {
    btn.addEventListener('click', async () => {
      const grantId = btn.dataset.grantId;
      try {
        await api.post(`/api/v1/consent/${grantId}/revoke`, {});
        showToast({
          type: 'success',
          message: 'Consent grant revoked successfully.',
        });
        renderStudentConsent(container);
      } catch (err) {
        showToast({
          type: 'error',
          message: `Failed to revoke consent: ${err.message}`,
        });
      }
    });
  });

  // Revoke all
  const revokeAllBtn = container.querySelector('#btn-revoke-all');
  if (revokeAllBtn) {
    revokeAllBtn.addEventListener('click', async () => {
      if (!confirm('Are you sure you want to revoke all active consent grants? Third-party verifications will be immediately rejected.')) {
        return;
      }

      try {
        for (const g of activeGrants) {
          await api.post(`/api/v1/consent/${g.id}/revoke`, {});
        }
        showToast({
          type: 'success',
          message: 'All active consent grants revoked.',
        });
        renderStudentConsent(container);
      } catch (err) {
        showToast({
          type: 'error',
          message: `Error revoking grants: ${err.message}`,
        });
      }
    });
  }
}
