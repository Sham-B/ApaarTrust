/**
 * Officer Duplicates Page
 * Cross-institution collision inspection with side-by-side comparison drawer
 */

import { api } from '../api.js';
import { renderAppShell, bindAppShellEvents } from '../ui/AppShell.js';
import { Drawer } from '../ui/Drawer.js';
import { statusPill } from '../ui/StatusPill.js';
import { iconHtml } from '../ui/icons.js';

export async function renderOfficerDuplicates(container) {
  let duplicateCases = [
    {
      id: 'dup_01',
      studentName: 'Rohan Aditya Sharma',
      apaarMasked: 'XXXX-XXXX-1100',
      unmaskedApaar: '5544-3322-1100',
      isRevealed: false,
      scores: { tokenMatch: 100, nameMatch: 98, dobMatch: 100 },
      inst1: {
        id: '1-1090123456',
        name: 'Aryabhata Institute of Technology',
        state: 'Delhi',
        programme: 'B.Tech Computer Science and Engineering',
        quota: 'Regular',
        admissionDate: '2024-08-10',
        roll: 'CSE-24-042',
      },
      inst2: {
        id: '1-1090345678',
        name: 'Chanakya Technological University',
        state: 'Karnataka',
        programme: 'B.Tech Computer Science and Engineering',
        quota: 'Regular',
        admissionDate: '2024-08-14',
        roll: 'CTU-24-118',
      },
      status: 'critical',
      decision: null,
      summary: 'Concurrent active full-time enrolment detected across two AICTE-approved institutions for Academic Year 2024-25.',
    },
  ];

  try {
    const remoteCases = await api.get('/api/v1/officer/duplicates');
    if (remoteCases && remoteCases.length > 0) {
      // Map remote case format if present
      duplicateCases = remoteCases.map((rc, idx) => ({
        ...duplicateCases[0],
        id: rc.case_id || `dup_0${idx + 1}`,
        studentName: rc.student_name || duplicateCases[0].studentName,
        apaarMasked: rc.apaar_masked || duplicateCases[0].apaarMasked,
        status: rc.status || 'critical',
      }));
    }
  } catch (err) {
    // Fallback to seeded case
  }

  function renderView() {
    const contentHtml = `
      <div class="page-header">
        <div class="page-header-text">
          <h1>Cross-Institution Duplicates & Collisions</h1>
          <p>Privacy-preserving collision detector identifying dual full-time active enrolments without leaking identities to college registrars.</p>
        </div>
        <div class="page-actions">
          <span class="status-pill status-${duplicateCases.some(c => !c.decision) ? 'problem' : 'good'}">
            ${duplicateCases.filter(c => !c.decision).length} Active Collisions
          </span>
        </div>
      </div>

      <!-- Duplicate Match Cards -->
      <div style="display: flex; flex-direction: column; gap: var(--space-4);">
        ${duplicateCases
          .map(
            (c) => `
          <div class="card" style="border-left: 4px solid ${c.decision ? 'var(--green)' : 'var(--red)'};">
            <div class="card-header">
              <div>
                <div style="display: flex; align-items: center; gap: 8px;">
                  <h3 style="margin: 0;">${c.studentName}</h3>
                  <span style="font-family: var(--font-mono); font-size: 0.8rem; color: var(--text-muted);">
                    ${c.isRevealed ? c.unmaskedApaar : c.apaarMasked}
                  </span>
                  ${c.decision 
                    ? statusPill('good', `Adjudicated: ${c.decision.toUpperCase()}`) 
                    : statusPill('problem', 'Collision Alert')}
                </div>
                <small style="color: var(--text-muted); margin-top: 2px;">${c.summary}</small>
              </div>
              <button class="btn btn-primary btn-sm btn-compare-dup" data-case-id="${c.id}">
                ${iconHtml('copy-check', 'icon-sm')} Side-by-side comparison & decision
              </button>
            </div>

            <div class="card-body">
              <!-- Score Breakdown Bars -->
              <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: var(--space-4); background: var(--bg-subtle); padding: 12px; border-radius: var(--radius-sm);">
                <div>
                  <div style="display: flex; justify-content: space-between; font-size: 0.78rem;">
                    <span>HMAC-SHA256 Token</span>
                    <span class="tabular font-bold" style="color: var(--red);">${c.scores.tokenMatch}%</span>
                  </div>
                  <div style="height: 6px; background: var(--border-subtle); border-radius: 3px; margin-top: 4px;">
                    <div style="width: ${c.scores.tokenMatch}%; height: 100%; background: var(--red); border-radius: 3px;"></div>
                  </div>
                </div>

                <div>
                  <div style="display: flex; justify-content: space-between; font-size: 0.78rem;">
                    <span>Name Phonetic Match</span>
                    <span class="tabular font-bold" style="color: var(--amber);">${c.scores.nameMatch}%</span>
                  </div>
                  <div style="height: 6px; background: var(--border-subtle); border-radius: 3px; margin-top: 4px;">
                    <div style="width: ${c.scores.nameMatch}%; height: 100%; background: var(--amber); border-radius: 3px;"></div>
                  </div>
                </div>

                <div>
                  <div style="display: flex; justify-content: space-between; font-size: 0.78rem;">
                    <span>Date of Birth Match</span>
                    <span class="tabular font-bold" style="color: var(--red);">${c.scores.dobMatch}%</span>
                  </div>
                  <div style="height: 6px; background: var(--border-subtle); border-radius: 3px; margin-top: 4px;">
                    <div style="width: ${c.scores.dobMatch}%; height: 100%; background: var(--red); border-radius: 3px;"></div>
                  </div>
                </div>
              </div>

              <!-- Two-Institution Comparison Preview -->
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
                <div style="padding: 12px; border: 1px solid var(--border-subtle); border-radius: var(--radius-sm);">
                  <span class="status-pill status-good" style="margin-bottom: 6px;">Institution A</span>
                  <div style="font-weight: 600;">${c.inst1.name}</div>
                  <div style="font-size: 0.8rem; color: var(--text-muted);">${c.inst1.programme}</div>
                  <div style="font-size: 0.78rem; color: var(--text-subtle); margin-top: 4px;">Admitted: ${c.inst1.admissionDate} · Roll: ${c.inst1.roll}</div>
                </div>

                <div style="padding: 12px; border: 1px solid var(--border-subtle); border-radius: var(--radius-sm);">
                  <span class="status-pill status-problem" style="margin-bottom: 6px;">Institution B (Conflicting)</span>
                  <div style="font-weight: 600;">${c.inst2.name}</div>
                  <div style="font-size: 0.8rem; color: var(--text-muted);">${c.inst2.programme}</div>
                  <div style="font-size: 0.78rem; color: var(--text-subtle); margin-top: 4px;">Admitted: ${c.inst2.admissionDate} · Roll: ${c.inst2.roll}</div>
                </div>
              </div>
            </div>
          </div>
        `
          )
          .join('')}
      </div>
    `;

    const breadcrumbs = [
      { label: 'Overview', href: '#/officer/overview' },
      { label: 'Duplicates', href: '#/officer/duplicates' },
    ];

    container.innerHTML = renderAppShell(contentHtml, breadcrumbs);
    bindAppShellEvents();

    // Bind side-by-side comparison drawer
    container.querySelectorAll('.btn-compare-dup').forEach((btn) => {
      btn.addEventListener('click', () => {
        const caseId = btn.dataset.caseId;
        const c = duplicateCases.find((x) => x.id === caseId) || duplicateCases[0];

        const drawerContent = `
          <div style="display: flex; flex-direction: column; gap: var(--space-4);">
            <div style="background: var(--status-problem-bg); padding: 12px; border-radius: var(--radius-sm); border-left: 3px solid var(--red);">
              <strong>Regulatory Action Required:</strong> Concurrent full-time active admission breaches Section 4.2 of AICTE Approval Process Handbook. An inquiry must be dispatched.
            </div>

            <!-- Reveal Full APAAR ID Safeguard -->
            <div style="background: var(--bg-subtle); padding: 12px; border-radius: var(--radius-sm); border: 1px dashed var(--border-subtle);">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                <strong>Identity Privacy Safeguard:</strong>
                <span style="font-family: monospace; font-size: 0.85rem;" id="drawerApaarDisplay">
                  ${c.isRevealed ? `🔓 ${c.unmaskedApaar}` : `🔒 ${c.apaarMasked}`}
                </span>
              </div>
              ${!c.isRevealed ? `
                <div style="font-size: 0.78rem; color: var(--text-muted); margin-bottom: 8px;">
                  Revealing full APAAR ID requires written justification and logs an immutable entry to the cryptographic audit trail.
                </div>
                <div style="display: flex; gap: 8px;">
                  <input type="text" id="revealReasonInput" class="form-input" style="flex: 1; font-size: 0.8rem;" placeholder="Mandatory written justification (min 10 chars)..." />
                  <button class="btn btn-secondary btn-sm" id="btnExecuteReveal">
                    ${iconHtml('eye', 'icon-sm')} Reveal Full APAAR
                  </button>
                </div>
                <div id="revealError" style="color: var(--red); font-size: 0.75rem; margin-top: 4px; display: none;"></div>
              ` : `
                <div style="font-size: 0.78rem; color: var(--green);">
                  ✓ Full APAAR ID revealed. Audit event anchored to hash ledger.
                </div>
              `}
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
              <div style="background: var(--bg-subtle); padding: 12px; border-radius: var(--radius-sm);">
                <h4>Institution 1</h4>
                <p><strong>${c.inst1.name}</strong></p>
                <p>ID: ${c.inst1.id}</p>
                <p>State: ${c.inst1.state}</p>
                <p>Programme: ${c.inst1.programme}</p>
                <p>Roll: ${c.inst1.roll}</p>
                <p>Admitted: ${c.inst1.admissionDate}</p>
              </div>

              <div style="background: var(--bg-subtle); padding: 12px; border-radius: var(--radius-sm);">
                <h4>Institution 2</h4>
                <p><strong>${c.inst2.name}</strong></p>
                <p>ID: ${c.inst2.id}</p>
                <p>State: ${c.inst2.state}</p>
                <p>Programme: ${c.inst2.programme}</p>
                <p>Roll: ${c.inst2.roll}</p>
                <p>Admitted: ${c.inst2.admissionDate}</p>
              </div>
            </div>

            <!-- Adjudication Decision Section -->
            <div style="border-top: 1px solid var(--border-subtle); padding-top: var(--space-3);">
              <h4>Officer Adjudication Decision</h4>
              <p style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 8px;">
                Select a decision and enter your mandatory written reason (min 10 characters). This will be recorded into the cryptographic audit log.
              </p>
              <textarea id="dupDecisionReason" class="form-textarea" rows="2" placeholder="e.g. Dispatched formal enquiry notice to both regional registrars per Section 4.2..."></textarea>
              <div id="decisionError" style="color: var(--red); font-size: 0.75rem; margin-top: 4px; display: none;"></div>

              <div style="display: flex; gap: 8px; margin-top: 10px; flex-wrap: wrap;">
                <button class="btn btn-secondary btn-sm btn-submit-decision" data-decision="needs_review">
                  ${iconHtml('clock', 'icon-sm')} Needs Review
                </button>
                <button class="btn btn-ghost btn-sm btn-submit-decision" data-decision="dismiss">
                  ${iconHtml('x-circle', 'icon-sm')} Dismiss with Reason
                </button>
                <button class="btn btn-danger btn-sm btn-submit-decision" data-decision="refer">
                  ${iconHtml('alert-triangle', 'icon-sm')} Refer for Regional Inspection
                </button>
              </div>
            </div>
          </div>
        `;

        const drawer = new Drawer({
          title: `Duplicate Collision: ${c.studentName}`,
          content: drawerContent,
          width: '580px',
        });
        drawer.open();

        // Reveal handler
        const btnReveal = drawer.backdrop.querySelector('#btnExecuteReveal');
        if (btnReveal) {
          btnReveal.addEventListener('click', async () => {
            const reasonInput = drawer.backdrop.querySelector('#revealReasonInput');
            const errDiv = drawer.backdrop.querySelector('#revealError');
            const reason = reasonInput.value.trim();

            if (reason.length < 10) {
              errDiv.textContent = 'A written justification of at least 10 characters is mandatory.';
              errDiv.style.display = 'block';
              return;
            }

            try {
              btnReveal.disabled = true;
              await api.post('/api/v1/students/1/reveal', { reason });
              c.isRevealed = true;
              drawer.close();

              window.dispatchEvent(
                new CustomEvent('apaar:toast', {
                  detail: {
                    type: 'success',
                    message: 'Full APAAR ID unmasked. Immutable audit event anchored to ledger.',
                  },
                })
              );

              renderView();
            } catch (err) {
              errDiv.textContent = err.message || 'Failed to reveal APAAR ID.';
              errDiv.style.display = 'block';
              btnReveal.disabled = false;
            }
          });
        }

        // Decision handlers
        drawer.backdrop.querySelectorAll('.btn-submit-decision').forEach((decBtn) => {
          decBtn.addEventListener('click', async () => {
            const decision = decBtn.dataset.decision;
            const reasonArea = drawer.backdrop.querySelector('#dupDecisionReason');
            const errDiv = drawer.backdrop.querySelector('#decisionError');
            const reason = reasonArea.value.trim();

            if (reason.length < 10) {
              errDiv.textContent = 'A written justification of at least 10 characters is mandatory.';
              errDiv.style.display = 'block';
              return;
            }

            try {
              decBtn.disabled = true;
              await api.post('/api/v1/officer/duplicate-decision', {
                case_id: c.id,
                decision: decision,
                reason: reason,
              });

              c.decision = decision;
              drawer.close();

              window.dispatchEvent(
                new CustomEvent('apaar:toast', {
                  detail: {
                    type: 'success',
                    message: `Decision '${decision}' recorded. Cryptographic audit log updated.`,
                  },
                })
              );

              renderView();
            } catch (err) {
              errDiv.textContent = err.message || 'Failed to submit decision.';
              errDiv.style.display = 'block';
              decBtn.disabled = false;
            }
          });
        });
      });
    });
  }

  renderView();
}

