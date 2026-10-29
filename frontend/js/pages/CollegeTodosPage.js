/**
 * College Compliance To-Dos Page
 */

import { api } from '../api.js';
import { store } from '../store.js';
import { renderAppShell } from '../ui/AppShell.js';
import { renderStatusPill } from '../ui/StatusPill.js';
import { renderEmptyState } from '../ui/EmptyState.js';
import { showToast } from '../ui/Toast.js';

export async function renderCollegeTodos(container) {
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
    errorMsg = err.message || 'Failed to load to-do items';
  }

  const findings = instData?.findings || [];
  const openFindings = findings.filter(f => f.status !== 'resolved');
  const criticalCount = openFindings.filter(f => f.severity === 'critical').length;
  const highCount = openFindings.filter(f => f.severity === 'high').length;
  const mediumCount = openFindings.filter(f => f.severity === 'medium').length;

  const contentHtml = `
    <div class="page-container">
      <div class="page-header">
        <div class="page-header-title">
          <h1>Compliance To-Dos & Fix Guide</h1>
          <p class="page-header-subtitle">
            Actionable items derived from automated validation checks. Follow step-by-step guidance to ensure clean data submission.
          </p>
        </div>
        <div class="page-header-actions">
          <a href="#/college/upload" class="btn btn-primary">
            <svg class="icon"><use href="vendor/lucide-sprite.svg#upload-cloud"></use></svg>
            Re-Upload Corrected File
          </a>
        </div>
      </div>

      ${errorMsg ? `
        <div class="toast toast-error" style="position: static; margin-bottom: 24px;">
          <svg class="icon"><use href="vendor/lucide-sprite.svg#alert-triangle"></use></svg>
          <div class="toast-content"><div class="toast-title">Error</div><div class="toast-message">${errorMsg}</div></div>
        </div>
      ` : ''}

      <!-- Status Summary Cards -->
      <div class="grid grid-3" style="margin-bottom: 32px;">
        <div class="card" style="border-left: 4px solid var(--danger);">
          <div style="font-size: 13px; color: var(--text-muted); text-transform: uppercase;">Critical Blockers</div>
          <div style="font-size: 28px; font-weight: 700; color: var(--danger); margin-top: 4px;" class="tabular-nums">
            ${criticalCount}
          </div>
          <div style="font-size: 12px; color: var(--text-muted); margin-top: 4px;">Must be resolved prior to official AICTE approval</div>
        </div>

        <div class="card" style="border-left: 4px solid var(--warning);">
          <div style="font-size: 13px; color: var(--text-muted); text-transform: uppercase;">High Severity Warnings</div>
          <div style="font-size: 28px; font-weight: 700; color: var(--warning); margin-top: 4px;" class="tabular-nums">
            ${highCount}
          </div>
          <div style="font-size: 12px; color: var(--text-muted); margin-top: 4px;">Potential data mismatches or quota breaches</div>
        </div>

        <div class="card" style="border-left: 4px solid var(--success);">
          <div style="font-size: 13px; color: var(--text-muted); text-transform: uppercase;">Total Active Items</div>
          <div style="font-size: 28px; font-weight: 700; color: var(--text-color); margin-top: 4px;" class="tabular-nums">
            ${openFindings.length}
          </div>
          <div style="font-size: 12px; color: var(--text-muted); margin-top: 4px;">Out of ${findings.length} total historical findings</div>
        </div>
      </div>

      <!-- To-Do Items List -->
      ${openFindings.length === 0 ? renderEmptyState({
        iconName: 'check-circle-2',
        title: 'All validation checks passing!',
        description: 'Your institution has no active compliance findings or blockers. All enrolled students comply with approved intake matrices.',
        actionHtml: '<a href="#/college/students" class="btn btn-secondary">View verified roster</a>'
      }) : `
        <div style="display: flex; flex-direction: column; gap: 16px;">
          ${openFindings.map((f, idx) => {
            const isCrit = f.severity === 'critical';
            const isHigh = f.severity === 'high';
            const borderCol = isCrit ? 'var(--danger)' : isHigh ? 'var(--warning)' : 'var(--border-color)';
            
            // Build tailored fix guidance
            let fixSteps = [];
            if (f.finding_type?.includes('OVER_INTAKE') || f.finding_type?.includes('INTAKE')) {
              fixSteps = [
                'Verify the actual admission register against the AICTE sanctioned intake letter.',
                'Check if students were admitted under supernumerary quotas (TFW/EWS/FN) but tagged under General in the spreadsheet.',
                'If excess admissions occurred, adjust allotment records or notify the AICTE Regional Officer.'
              ];
            } else if (f.finding_type?.includes('MISMATCH') || f.finding_type?.includes('REGISTRY')) {
              fixSteps = [
                'Inspect the student’s APAAR card or DigiLocker profile for the exact registered name and Date of Birth.',
                'Ensure the student name in your institute database matches the APAAR Central Registry without typographical errors.',
                'Update the corrected values in your local database and re-export the intake Excel sheet.'
              ];
            } else if (f.finding_type?.includes('DUPLICATE')) {
              fixSteps = [
                'Review the student’s identity token across participating institutions.',
                'Contact the student to verify if they held a provisional seat elsewhere and have formally submitted their Migration / TC.',
                'Upload the formal cancellation order from the previous institution.'
              ];
            } else {
              fixSteps = [
                'Review the flagged row in your intake Excel spreadsheet.',
                'Check field formatting: APAAR IDs must be 12 numeric digits; dates in YYYY-MM-DD format.',
                'Re-run the Upload Dry-Run to verify that the check passes.'
              ];
            }

            return `
              <div class="card" style="border-left: 4px solid ${borderCol}; padding: 20px;">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; margin-bottom: 12px;">
                  <div>
                    <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 6px;">
                      <span class="badge ${isCrit ? 'badge-danger' : isHigh ? 'badge-warning' : ''}" style="text-transform: uppercase; font-size: 11px; font-weight: 700;">
                        ${f.severity || 'HIGH'}
                      </span>
                      <strong style="font-size: 16px; color: var(--text-color);">
                        ${f.finding_type?.replace(/_/g, ' ') || 'Validation Finding'}
                      </strong>
                    </div>
                    <div style="font-size: 13px; color: var(--text-muted);">
                      Affected Student / Programme: <strong style="color: var(--text-color);">${f.details?.student_name || f.details?.programme || 'Enrolment batch'}</strong>
                      ${f.student_apaar_masked ? ` &bull; Masked APAAR: <code style="font-family: monospace;">${f.student_apaar_masked}</code>` : ''}
                    </div>
                  </div>
                  <div>
                    ${renderStatusPill({
                      status: f.status === 'in_review' ? 'pending' : 'invalid',
                      label: f.status === 'in_review' ? 'In Review' : 'Action Required'
                    })}
                  </div>
                </div>

                <div style="background: var(--bg-surface-elevated); padding: 12px 16px; border-radius: var(--radius-sm); margin-bottom: 16px; font-size: 13px; line-height: 1.5;">
                  <strong>Observation:</strong> ${f.plain_reason || f.details?.reason || 'Compliance inconsistency detected during automated validation.'}
                </div>

                <!-- Fix Guide Accordion / Box -->
                <div style="border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 14px; background: rgba(20, 48, 122, 0.02); margin-bottom: 16px;">
                  <div style="font-weight: 600; font-size: 13px; color: var(--primary); display: flex; align-items: center; gap: 6px; margin-bottom: 8px;">
                    <svg class="icon"><use href="vendor/lucide-sprite.svg#wrench"></use></svg>
                    How to Fix this Finding:
                  </div>
                  <ol style="margin: 0; padding-left: 20px; font-size: 13px; color: var(--text-muted); display: flex; flex-direction: column; gap: 6px;">
                    ${fixSteps.map(step => `<li>${step}</li>`).join('')}
                  </ol>
                </div>

                <div style="display: flex; justify-content: flex-end; gap: 12px; align-items: center;">
                  <a href="#/college/upload" class="btn btn-secondary btn-sm">
                    <svg class="icon"><use href="vendor/lucide-sprite.svg#upload-cloud"></use></svg>
                    Fix in Upload Wizard
                  </a>
                  <a href="#/college/students" class="btn btn-ghost btn-sm">
                    <svg class="icon"><use href="vendor/lucide-sprite.svg#users"></use></svg>
                    Inspect in Roster
                  </a>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `}
    </div>
  `;

  renderAppShell(container, contentHtml, 'todos');
}
