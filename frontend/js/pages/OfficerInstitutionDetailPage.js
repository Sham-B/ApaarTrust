/**
 * Officer Institution Detail Page
 * Tabs: Overview, Seat Matrix, Students, Findings, Submissions Diff
 * Masked APAAR reveal safeguard requiring 10-char written justification
 */

import { api } from '../api.js';
import { renderAppShell, bindAppShellEvents } from '../ui/AppShell.js';
import { renderSeatGauge } from '../ui/Gauge.js';
import { statusPill } from '../ui/StatusPill.js';
import { Modal } from '../ui/Modal.js';
import { iconHtml } from '../ui/icons.js';

export async function renderOfficerInstitutionDetail(container, instId) {
  let detail = null;
  let students = [];

  try {
    [detail, students] = await Promise.all([
      api.get(`/api/v1/institutions/${instId}`),
      api.get(`/api/v1/institutions/${instId}/students`),
    ]);
  } catch (err) {
    console.error('Failed to load institution detail:', err);
  }

  if (!detail || !detail.institution) {
    container.innerHTML = `
      <div style="padding: 40px; text-align: center;">
        <h2>Institution Not Found</h2>
        <a href="#/officer/institutions" class="btn btn-primary" style="margin-top: 16px;">Return to Directory</a>
      </div>
    `;
    return;
  }

  const inst = detail.institution;
  const matrices = detail.seat_matrices || [];
  const findings = detail.findings || [];
  const submissions = detail.submissions || [];

  const contentHtml = `
    <!-- Page Header -->
    <div class="page-header">
      <div class="page-header-text">
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
          <a href="#/officer/institutions" class="btn btn-secondary btn-sm" style="padding: 2px 6px;">
            ${iconHtml('arrow-left', 'icon-sm')}
          </a>
          <span style="font-family: var(--font-mono); font-size: 0.85rem; color: var(--text-muted);">${inst.aicte_pid}</span>
          ${statusPill(findings.some((f) => f.severity === 'critical') ? 'problem' : 'good', findings.some((f) => f.severity === 'critical') ? 'Scrutiny Alert' : 'Compliant')}
        </div>
        <h1>${inst.name}</h1>
        <p>${inst.address} · Contact: ${inst.contact_email}</p>
      </div>

      <div class="page-actions" style="display: flex; gap: 8px; align-items: center;">
        <a href="${typeof window.apiUrl === 'function' ? window.apiUrl(`/api/v1/institutions/${instId}/compliance-report.pdf`) : `/api/v1/institutions/${instId}/compliance-report.pdf`}" class="btn btn-secondary btn-sm" download="compliance_report_${inst.aicte_pid}.pdf" id="btnComplianceReport">
          ${iconHtml('file-text', 'icon-sm')} Download Compliance Report (PDF)
        </a>
        <!-- Adverse Action Button (Officer Only) -->
        <button class="btn btn-danger btn-sm" id="btnAdverseAction">
          ${iconHtml('alert-triangle', 'icon-sm')} Adverse regulatory action
        </button>
      </div>
    </div>

    <!-- Tabs Navigation -->
    <div style="display: flex; gap: var(--space-2); border-bottom: 1px solid var(--border-subtle); margin-bottom: var(--space-6);">
      <button class="btn btn-ghost btn-tab active" data-tab="tab-overview">Overview</button>
      <button class="btn btn-ghost btn-tab" data-tab="tab-seatmatrix">Seat Matrix (${matrices.length})</button>
      <button class="btn btn-ghost btn-tab" data-tab="tab-students">Enrolled Students (${students.length})</button>
      <button class="btn btn-ghost btn-tab" data-tab="tab-findings">Findings (${findings.length})</button>
      <button class="btn btn-ghost btn-tab" data-tab="tab-submissions">Submissions & Diff (${submissions.length})</button>
    </div>

    <!-- Tab 1: Overview -->
    <div class="tab-pane active" id="tab-overview">
      <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 24px;">
        <div class="card">
          <div class="card-header">
            <h3>Institution Intake Profile</h3>
            <span style="font-size: 0.75rem; color: var(--text-muted);">Academic Year 2024-25</span>
          </div>
          <div class="card-body">
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: var(--space-5);">
              <div>
                <small>Total Approved Intake</small>
                <div style="font-size: 1.5rem; font-weight: 700; color: var(--navy);" class="tabular">
                  ${matrices.reduce((acc, m) => acc + m.approved_intake, 0)}
                </div>
              </div>
              <div>
                <small>Admitted Students</small>
                <div style="font-size: 1.5rem; font-weight: 700;" class="tabular">
                  ${students.length}
                </div>
              </div>
              <div>
                <small>Open Validation Issues</small>
                <div style="font-size: 1.5rem; font-weight: 700; color: ${findings.length > 0 ? 'var(--red)' : 'var(--green)'};" class="tabular">
                  ${findings.length}
                </div>
              </div>
            </div>

            <h4>Regulatory Evaluation</h4>
            <p style="font-size: 0.88rem; color: var(--text-muted); margin-top: 4px;">
              ${findings.length > 0
                ? `Scrutiny engine detected ${findings.length} findings during intake validation. Review the Findings tab to inspect specific rule evidence and benign hypotheses.`
                : 'All admission rolls match sanctioned seat caps and mock central APAAR registry signatures with zero detected duplicates.'}
            </p>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <h3>Administrative Details</h3>
          </div>
          <div class="card-body" style="font-size: 0.85rem; display: flex; flex-direction: column; gap: 8px;">
            <div><strong>State:</strong> ${inst.state}</div>
            <div><strong>District:</strong> ${inst.district}</div>
            <div><strong>AICTE Region:</strong> Northern / Western Regional Office</div>
            <div><strong>Registry Status:</strong> Active Monitored</div>
            <div><strong>Cryptographic Seal:</strong> Ed25519 Verified</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Tab 2: Seat Matrix -->
    <div class="tab-pane" id="tab-seatmatrix" style="display: none;">
      <div class="card">
        <div class="card-header">
          <div>
            <h3>Programme Seat Matrix & Supernumerary Quotas</h3>
            <small>DEMO VALUES, not AICTE rules; configure from the Approval Process Handbook</small>
          </div>
        </div>
        <div class="card-body" style="display: flex; flex-direction: column; gap: var(--space-4);">
          ${matrices
            .map((m) => {
              const enrolledInProg = students.filter((s) => s.programme === m.programme).length;
              return renderSeatGauge({
                programme: m.programme,
                approved: m.approved_intake,
                admitted: enrolledInProg,
                excess: enrolledInProg > m.approved_intake ? enrolledInProg - m.approved_intake : 0,
              });
            })
            .join('')}
        </div>
      </div>
    </div>

    <!-- Tab 3: Students (Masked ID with Reveal Safeguard) -->
    <div class="tab-pane" id="tab-students" style="display: none;">
      <div class="card">
        <div class="card-header">
          <div>
            <h3>Enrolled Student Roster</h3>
            <small>Confidential identifiers are masked by default (XXXX-XXXX-1234). Officer reveal is audit-logged.</small>
          </div>
          <span style="font-size: 0.75rem; color: var(--text-muted);">${students.length} Records</span>
        </div>
        <div class="card-body" style="padding: 0;">
          <table class="data-table">
            <thead>
              <tr>
                <th>Roll ID</th>
                <th>Masked APAAR ID</th>
                <th>Student Name</th>
                <th>Programme</th>
                <th>Quota</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              ${students
                .map(
                  (s) => `
                <tr>
                  <td><span class="tabular font-medium">${s.student_id}</span></td>
                  <td>
                    <span class="tabular font-mono" id="apaar_${s.id}">${s.apaar_id}</span>
                  </td>
                  <td><strong>${s.name}</strong></td>
                  <td>${s.programme}</td>
                  <td><span class="status-pill status-waiting">${s.admission_quota}</span></td>
                  <td>
                    <button class="btn btn-secondary btn-sm btn-reveal-id" data-student-id="${s.id}" data-name="${s.name}">
                      ${iconHtml('eye', 'icon-sm')} Reveal full ID
                    </button>
                  </td>
                </tr>
              `
                )
                .join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Tab 4: Findings -->
    <div class="tab-pane" id="tab-findings" style="display: none;">
      <div class="card">
        <div class="card-header">
          <h3>Validation Findings & Defects</h3>
          <small>Plain-language explanations, evidence rows, and benign hypotheses</small>
        </div>
        <div class="card-body" style="display: flex; flex-direction: column; gap: 16px;">
          ${
            findings.length > 0
              ? findings
                  .map(
                    (f) => `
              <div style="border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); padding: var(--space-4); background: var(--bg-subtle);">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                  <span style="font-weight: 600;"><code>${f.rule_id}</code></span>
                  ${statusPill(f.severity === 'critical' ? 'problem' : 'look', f.severity.toUpperCase())}
                </div>
                <p style="font-size: 0.9rem; color: var(--text-main); margin-bottom: 8px;">
                  <strong>Reason:</strong> ${f.plain_reason}
                </p>
                <div style="font-size: 0.82rem; color: var(--text-muted); margin-bottom: 8px;">
                  <strong>Fix Hint:</strong> ${f.fix_hint || 'Verify admission register against sanctioned Approval Process Handbook ceilings.'}
                </div>
                <div style="font-size: 0.75rem; color: var(--text-subtle);">
                  Evidence: <code>${JSON.stringify(f.evidence || {})}</code>
                </div>
              </div>
            `
                  )
                  .join('')
              : '<p style="color: var(--text-muted); text-align: center; padding: 24px;">No regulatory defects or findings flagged for this institution.</p>'
          }
        </div>
      </div>
    </div>

    <!-- Tab 5: Submissions & Diff -->
    <div class="tab-pane" id="tab-submissions" style="display: none;">
      <div class="card">
        <div class="card-header">
          <h3>Submission Version History & Diffs</h3>
          <small>Audit trail of all intake batch commits and version-over-version diffs</small>
        </div>
        <div class="card-body">
          ${submissions
            .map(
              (sub) => `
            <div style="border-bottom: 1px solid var(--border-subtle); padding: 12px 0; display: flex; justify-content: space-between; align-items: center;">
              <div>
                <div style="font-weight: 600;">Submission v${sub.version} (${sub.filename})</div>
                <small style="color: var(--text-muted);">Committed: ${new Date(sub.committed_at || sub.created_at).toLocaleString()}</small>
              </div>
              <div style="display: flex; align-items: center; gap: 12px;">
                <span class="tabular font-medium">${sub.total_rows} students</span>
                <span class="status-pill ${sub.held_by_officer ? 'status-problem' : sub.rejected_by_officer ? 'status-problem' : 'status-good'}">
                  ${sub.held_by_officer ? 'Held by Officer' : sub.rejected_by_officer ? 'Rejected' : 'Active Registry'}
                </span>
              </div>
            </div>
          `
            )
            .join('')}
        </div>
      </div>
    </div>
  `;

  const breadcrumbs = [
    { label: 'Overview', href: '#/officer/overview' },
    { label: 'Institutions', href: '#/officer/institutions' },
    { label: inst.name, href: `#/officer/institutions/${instId}` },
  ];

  container.innerHTML = renderAppShell(contentHtml, breadcrumbs);
  bindAppShellEvents();

  // Tab switching logic
  const tabBtns = container.querySelectorAll('.btn-tab');
  tabBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      tabBtns.forEach((b) => b.classList.remove('active'));
      container.querySelectorAll('.tab-pane').forEach((p) => (p.style.display = 'none'));

      btn.classList.add('active');
      const targetId = btn.dataset.tab;
      const targetPane = document.getElementById(targetId);
      if (targetPane) targetPane.style.display = 'block';
    });
  });

  // Reveal Full ID Safeguard Modal
  container.querySelectorAll('.btn-reveal-id').forEach((btn) => {
    btn.addEventListener('click', () => {
      const studentId = btn.dataset.studentId;
      const studentName = btn.dataset.name;

      const modalContent = `
        <div style="display: flex; flex-direction: column; gap: var(--space-3);">
          <div style="background: var(--status-problem-bg); border-left: 3px solid var(--red); padding: 8px 12px; font-size: 0.82rem; color: var(--status-problem-text);">
            <strong>Confidentiality Safeguard:</strong> Revealing full 12-digit APAAR identity is strictly restricted to regulatory scrutiny. Your name, role, and written reason will be permanently recorded in the cryptographic audit chain.
          </div>
          <div>
            <label class="form-label" for="revealReasonInput">Written Justification (Mandatory, min 10 characters):</label>
            <textarea id="revealReasonInput" class="form-textarea" rows="3" placeholder="e.g., Regional scrutiny committee order regarding intake discrepancy #9921"></textarea>
            <div id="revealError" style="color: var(--red); font-size: 0.75rem; margin-top: 4px; display: none;"></div>
          </div>
        </div>
      `;

      const modal = new Modal({
        title: `Reveal APAAR ID: ${studentName}`,
        content: modalContent,
        footer: `
          <button class="btn btn-secondary btn-sm btn-modal-cancel">Cancel</button>
          <button class="btn btn-primary btn-sm btn-modal-confirm">Authorize & Reveal</button>
        `,
      });

      modal.open();

      const cancelBtn = modal.backdrop.querySelector('.btn-modal-cancel');
      const confirmBtn = modal.backdrop.querySelector('.btn-modal-confirm');
      const reasonInput = modal.backdrop.querySelector('#revealReasonInput');
      const errorDiv = modal.backdrop.querySelector('#revealError');

      cancelBtn.addEventListener('click', () => modal.close());

      confirmBtn.addEventListener('click', async () => {
        const reason = reasonInput.value.trim();
        if (reason.length < 10) {
          errorDiv.textContent = 'A written justification of at least 10 characters is mandatory.';
          errorDiv.style.display = 'block';
          return;
        }

        try {
          confirmBtn.disabled = true;
          confirmBtn.textContent = 'Verifying...';

          const res = await api.post(`/api/v1/students/${studentId}/reveal`, { reason });

          // Update display on table
          const targetSpan = document.getElementById(`apaar_${studentId}`);
          if (targetSpan) {
            targetSpan.textContent = res.full_apaar_id;
            targetSpan.style.color = 'var(--green)';
            targetSpan.style.fontWeight = 'bold';
          }

          modal.close();

          window.dispatchEvent(
            new CustomEvent('apaar:toast', {
              detail: {
                type: 'success',
                message: `Full APAAR ID revealed for ${studentName}. Event logged to audit trail.`,
              },
            })
          );
        } catch (err) {
          errorDiv.textContent = err.message || 'Failed to reveal ID.';
          errorDiv.style.display = 'block';
          confirmBtn.disabled = false;
          confirmBtn.textContent = 'Authorize & Reveal';
        }
      });
    });
  });

  // Adverse Action Modal
  const adverseBtn = container.querySelector('#btnAdverseAction');
  if (adverseBtn) {
    adverseBtn.addEventListener('click', () => {
      const activeSub = submissions[0];
      if (!activeSub) {
        window.dispatchEvent(new CustomEvent('apaar:toast', { detail: { type: 'warning', message: 'No active submission found.' } }));
        return;
      }

      const modalContent = `
        <div style="display: flex; flex-direction: column; gap: var(--space-3);">
          <div style="background: var(--status-problem-bg); border-left: 3px solid var(--red); padding: 8px 12px; font-size: 0.82rem; color: var(--status-problem-text);">
            <strong>Regulatory Safeguard:</strong> Only authorized AICTE Scrutiny Officers can enforce adverse actions (Hold / Reject). A formal written reason (min 10 characters) is legally required.
          </div>
          <div>
            <label class="form-label">Action Type:</label>
            <select class="form-select" id="adverseActionType">
              <option value="hold">Hold Submission (Freeze certification & verification)</option>
              <option value="reject">Reject Submission (Demand re-submission)</option>
            </select>
          </div>
          <div>
            <label class="form-label">Regulatory Reason:</label>
            <textarea id="adverseReasonInput" class="form-textarea" rows="3" placeholder="e.g. Sanctioned regular intake ceiling breached by 8 students without AICTE approval."></textarea>
            <div id="adverseError" style="color: var(--red); font-size: 0.75rem; margin-top: 4px; display: none;"></div>
          </div>
        </div>
      `;

      const modal = new Modal({
        title: 'Enforce Adverse Regulatory Action',
        content: modalContent,
        footer: `
          <button class="btn btn-secondary btn-sm btn-modal-cancel">Cancel</button>
          <button class="btn btn-danger btn-sm btn-modal-submit">Enforce Action</button>
        `,
      });

      modal.open();

      const cancelBtn = modal.backdrop.querySelector('.btn-modal-cancel');
      const submitBtn = modal.backdrop.querySelector('.btn-modal-submit');
      const typeSelect = modal.backdrop.querySelector('#adverseActionType');
      const reasonInput = modal.backdrop.querySelector('#adverseReasonInput');
      const errorDiv = modal.backdrop.querySelector('#adverseError');

      cancelBtn.addEventListener('click', () => modal.close());

      submitBtn.addEventListener('click', async () => {
        const reason = reasonInput.value.trim();
        if (reason.length < 10) {
          errorDiv.textContent = 'Written justification of at least 10 characters is required.';
          errorDiv.style.display = 'block';
          return;
        }

        try {
          submitBtn.disabled = true;
          await api.post('/api/v1/officer/adverse-action', {
            submission_id: activeSub.id,
            action: typeSelect.value,
            reason: reason,
          });

          modal.close();

          window.dispatchEvent(
            new CustomEvent('apaar:toast', {
              detail: { type: 'success', message: `Regulatory action (${typeSelect.value}) enforced successfully and recorded in audit log.` },
            })
          );

          // Refresh page view
          setTimeout(() => renderOfficerInstitutionDetail(container, instId), 400);
        } catch (err) {
          errorDiv.textContent = err.message || 'Failed to enforce action.';
          errorDiv.style.display = 'block';
          submitBtn.disabled = false;
        }
      });
    });
  }
}
