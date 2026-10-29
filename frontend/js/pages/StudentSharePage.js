/**
 * Student Share Credential & Zero-Exposure Simulator Page
 */

import { api } from '../api.js';
import { store } from '../store.js';
import { renderAppShell } from '../ui/AppShell.js';
import { renderStatusPill } from '../ui/StatusPill.js';
import { showToast } from '../ui/Toast.js';

export async function renderStudentShare(container) {
  const { persona } = store.getState();
  const token = persona?.student_token || 'tok_rohan_sharma';

  let recordData = null;
  let loading = true;
  let errorMsg = null;

  try {
    recordData = await api.getStudentRecord(token);
    loading = false;
  } catch (err) {
    loading = false;
    errorMsg = err.message || 'Failed to load credential for sharing';
  }

  const credId = recordData?.credential_id;

  const contentHtml = `
    <div class="page-container">
      <div class="page-header">
        <div class="page-header-title">
          <h1>Share Credential & Zero-Exposure Simulator</h1>
          <p class="page-header-subtitle">
            Generate verifiable presentations with selective disclosure. Prove your student status without disclosing sensitive personal data.
          </p>
        </div>
      </div>

      ${errorMsg ? `
        <div class="toast toast-error" style="position: static; margin-bottom: 24px;">
          <svg class="icon"><use href="vendor/lucide-sprite.svg#alert-triangle"></use></svg>
          <div class="toast-content"><div class="toast-title">Error</div><div class="toast-message">${errorMsg}</div></div>
        </div>
      ` : ''}

      <div class="grid grid-2" style="gap: 32px; align-items: start;">
        <!-- Left: Presentation Builder -->
        <div class="card">
          <h3 style="margin: 0 0 16px 0; font-size: 16px; display: flex; align-items: center; gap: 8px;">
            <svg class="icon" style="color: var(--primary);"><use href="vendor/lucide-sprite.svg#sliders"></use></svg>
            1. Configure Selective Disclosure
          </h3>

          <div style="margin-bottom: 16px;">
            <label style="display: block; font-size: 12px; font-weight: 600; text-transform: uppercase; margin-bottom: 6px; color: var(--text-muted);">
              Verifier Purpose / Organization
            </label>
            <input type="text" id="share-purpose" class="input" value="Campus Placement Verification" placeholder="e.g., Campus Placement, Scholarship, Visa" />
          </div>

          <div style="margin-bottom: 20px;">
            <label style="display: block; font-size: 12px; font-weight: 600; text-transform: uppercase; margin-bottom: 8px; color: var(--text-muted);">
              Select Disclosed Attributes
            </label>
            <div style="display: flex; flex-direction: column; gap: 8px;">
              <label class="card" style="padding: 10px 14px; margin: 0; display: flex; align-items: center; gap: 10px; cursor: pointer; background: var(--bg-surface-elevated);">
                <input type="checkbox" id="field-name" checked disabled />
                <div style="flex: 1;">
                  <span style="font-weight: 600; font-size: 13px;">Full Name</span>
                  <div style="font-size: 11px; color: var(--text-muted);">Required for credential subject identification</div>
                </div>
                <span class="badge">Required</span>
              </label>

              <label class="card" style="padding: 10px 14px; margin: 0; display: flex; align-items: center; gap: 10px; cursor: pointer; background: var(--bg-surface-elevated);">
                <input type="checkbox" id="field-programme" checked />
                <div style="flex: 1;">
                  <span style="font-weight: 600; font-size: 13px;">Programme & Branch</span>
                  <div style="font-size: 11px; color: var(--text-muted);">e.g. B.Tech Computer Science and Engineering</div>
                </div>
                <span class="badge">Disclosed</span>
              </label>

              <label class="card" style="padding: 10px 14px; margin: 0; display: flex; align-items: center; gap: 10px; cursor: pointer; background: var(--bg-surface-elevated);">
                <input type="checkbox" id="field-institution" checked />
                <div style="flex: 1;">
                  <span style="font-weight: 600; font-size: 13px;">Institution Name</span>
                  <div style="font-size: 11px; color: var(--text-muted);">Aryabhata Institute of Technology</div>
                </div>
                <span class="badge">Disclosed</span>
              </label>

              <label class="card" style="padding: 10px 14px; margin: 0; display: flex; align-items: center; gap: 10px; cursor: pointer; background: var(--bg-surface-elevated);">
                <input type="checkbox" id="field-enrolment" checked />
                <div style="flex: 1;">
                  <span style="font-weight: 600; font-size: 13px;">Active Enrolment Status</span>
                  <div style="font-size: 11px; color: var(--text-muted);">Validates current academic standing</div>
                </div>
                <span class="badge">Disclosed</span>
              </label>

              <label class="card" style="padding: 10px 14px; margin: 0; display: flex; align-items: center; gap: 10px; cursor: pointer; background: var(--bg-surface-elevated); border-left: 3px solid var(--warning);">
                <input type="checkbox" id="field-dob" />
                <div style="flex: 1;">
                  <span style="font-weight: 600; font-size: 13px;">Date of Birth (Sensitive)</span>
                  <div style="font-size: 11px; color: var(--text-muted);">Recommended withheld to prevent identity theft</div>
                </div>
                <span class="badge badge-warning">Withheld</span>
              </label>

              <label class="card" style="padding: 10px 14px; margin: 0; display: flex; align-items: center; gap: 10px; cursor: pointer; background: var(--bg-surface-elevated); border-left: 3px solid var(--warning);">
                <input type="checkbox" id="field-category" />
                <div style="flex: 1;">
                  <span style="font-weight: 600; font-size: 13px;">Affirmative Action / Social Category (Sensitive)</span>
                  <div style="font-size: 11px; color: var(--text-muted);">Withheld to prevent unconscious bias in hiring</div>
                </div>
                <span class="badge badge-warning">Withheld</span>
              </label>
            </div>
          </div>

          <button id="btn-generate-presentation" class="btn btn-primary" style="width: 100%; justify-content: center;">
            <svg class="icon"><use href="vendor/lucide-sprite.svg#qr-code"></use></svg>
            Generate & Simulate Verification
          </button>
        </div>

        <!-- Right: Real-Time Verification Simulator -->
        <div>
          <div class="card" style="border: 2px solid var(--border-color); background: var(--bg-surface);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
              <h3 style="margin: 0; font-size: 16px; display: flex; align-items: center; gap: 8px;">
                <svg class="icon" style="color: var(--success);"><use href="vendor/lucide-sprite.svg#shield-check"></use></svg>
                2. Live Verifier View (Simulator)
              </h3>
              <span class="badge">Real-Time</span>
            </div>

            <p style="font-size: 13px; color: var(--text-muted); margin-bottom: 16px;">
              This demonstrates exactly what a third-party verifier (employer, university, bank) sees when they scan or check your presentation.
            </p>

            <div id="simulator-output">
              <div style="padding: 32px 20px; text-align: center; color: var(--text-muted); background: var(--bg-surface-elevated); border-radius: var(--radius-sm);">
                <svg class="icon" style="width: 32px; height: 32px; margin-bottom: 8px; opacity: 0.5;"><use href="vendor/lucide-sprite.svg#play-circle"></use></svg>
                <div>Click <strong>Generate & Simulate Verification</strong> to run the live cryptographic check.</div>
              </div>
            </div>
          </div>

          <!-- Share QR and JSON Section (Hidden until generated) -->
          <div id="share-export-card" class="card" style="display: none; margin-top: 20px;">
            <h4 style="margin: 0 0 12px 0; font-size: 14px; display: flex; align-items: center; gap: 6px;">
              <svg class="icon" style="color: var(--primary);"><use href="vendor/lucide-sprite.svg#share-2"></use></svg>
              Share Presentation
            </h4>
            <div style="display: flex; gap: 16px; align-items: center; margin-bottom: 16px;">
              <div id="presentation-qr-container" style="background: #ffffff; padding: 6px; border-radius: 8px; border: 1px solid var(--border-color);">
                <img id="presentation-qr-img" src="" alt="Presentation QR" style="width: 80px; height: 80px; display: block;" />
              </div>
              <div style="flex: 1; font-size: 12px; color: var(--text-muted); line-height: 1.5;">
                Verifiers can scan this QR code directly in the <a href="#/verify" style="color: var(--primary); font-weight: 600;">ApaarTrust Public Verifier</a> to inspect the disclosed fields.
              </div>
            </div>
            <button id="btn-copy-presentation" class="btn btn-secondary btn-sm" style="width: 100%; justify-content: center;">
              <svg class="icon"><use href="vendor/lucide-sprite.svg#copy"></use></svg>
              Copy Presentation JSON
            </button>
          </div>
        </div>
      </div>
    </div>
  `;

  renderAppShell(container, contentHtml, 'share');

  // Wire simulator execution
  const generateBtn = container.querySelector('#btn-generate-presentation');
  const simOutput = container.querySelector('#simulator-output');
  const shareExportCard = container.querySelector('#share-export-card');
  const qrImg = container.querySelector('#presentation-qr-img');
  let currentPresentation = null;

  if (generateBtn) {
    generateBtn.addEventListener('click', async () => {
      generateBtn.disabled = true;
      generateBtn.innerHTML = `<span class="spinner" style="width: 14px; height: 14px; border-width: 2px;"></span> Simulating verification...`;

      try {
        const purpose = container.querySelector('#share-purpose').value.trim() || 'Public Verification';
        const targetCredId = credId || 'cred_a042_cse';

        // 1. Fetch generated presentation
        const presentation = await api.get(`/api/v1/credentials/${targetCredId}/presentation?purpose=${encodeURIComponent(purpose)}`);
        currentPresentation = presentation;

        // Apply field selections (if unchecked, strip the disclosure salt from presentation)
        const discloseDob = container.querySelector('#field-dob').checked;
        const discloseCat = container.querySelector('#field-category').checked;
        const discloseProg = container.querySelector('#field-programme').checked;

        if (!discloseDob && presentation.disclosures?.dob) {
          delete presentation.disclosures.dob;
        }
        if (!discloseCat && presentation.disclosures?.social_category) {
          delete presentation.disclosures.social_category;
        }
        if (!discloseProg && presentation.disclosures?.programme) {
          delete presentation.disclosures.programme;
        }

        // 2. Call real verify API
        const verifyResult = await api.post('/api/v1/verify/presentation?verifier_type=Zero-Exposure%20Simulator', presentation);

        // 3. Render Simulator Output
        const isGenuine = verifyResult.status === 'genuine';
        const disclosed = verifyResult.disclosed_fields || [];
        const withheld = verifyResult.withheld_fields || [];

        simOutput.innerHTML = `
          <div>
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; padding-bottom: 12px; border-bottom: 1px solid var(--border-color);">
              <div style="display: flex; align-items: center; gap: 8px;">
                <svg class="icon" style="color: ${isGenuine ? 'var(--success)' : 'var(--danger)'}; width: 20px; height: 20px;">
                  <use href="vendor/lucide-sprite.svg#${isGenuine ? 'check-circle-2' : 'alert-octagon'}"></use>
                </svg>
                <strong style="font-size: 15px; color: ${isGenuine ? 'var(--success)' : 'var(--danger)'};">
                  ${isGenuine ? 'Cryptographically Verified Genuine' : 'Verification Failed'}
                </strong>
              </div>
              ${renderStatusPill({
                status: isGenuine ? 'valid' : 'invalid',
                label: isGenuine ? 'Ed25519 Verified' : 'Invalid'
              })}
            </div>

            <!-- Disclosed Attributes -->
            <div style="margin-bottom: 16px;">
              <div style="font-size: 12px; font-weight: 700; text-transform: uppercase; color: var(--success); margin-bottom: 8px; display: flex; align-items: center; gap: 6px;">
                <svg class="icon"><use href="vendor/lucide-sprite.svg#check"></use></svg>
                Disclosed & Authenticated by Verifier (${disclosed.length})
              </div>
              <div style="background: rgba(19, 136, 8, 0.05); border: 1px solid rgba(19, 136, 8, 0.2); border-radius: var(--radius-sm); padding: 12px;">
                <table style="width: 100%; font-size: 13px;">
                  ${disclosed.map(d => `
                    <tr>
                      <td style="color: var(--text-muted); padding: 4px 0; width: 40%; text-transform: capitalize;">${d.field?.replace(/_/g, ' ') || 'Attribute'}:</td>
                      <td style="font-weight: 600; padding: 4px 0;">${d.value || '-'}</td>
                    </tr>
                  `).join('')}
                </table>
              </div>
            </div>

            <!-- Withheld Attributes -->
            <div style="margin-bottom: 16px;">
              <div style="font-size: 12px; font-weight: 700; text-transform: uppercase; color: var(--text-muted); margin-bottom: 8px; display: flex; align-items: center; gap: 6px;">
                <svg class="icon"><use href="vendor/lucide-sprite.svg#lock"></use></svg>
                Withheld & Cryptographically Blinded (${withheld.length})
              </div>
              <div style="background: var(--bg-surface-elevated); border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 12px; font-size: 12px; color: var(--text-muted); line-height: 1.5;">
                ${withheld.length > 0 ? `
                  <div style="display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 6px;">
                    ${withheld.map(w => `<span class="badge">${w}</span>`).join('')}
                  </div>
                  <div>These values were not transmitted to the verifier. The verifier confirmed their authenticity solely via cryptographic salted commitments.</div>
                ` : `
                  <div>All attributes were disclosed in this presentation.</div>
                `}
              </div>
            </div>

            <div style="font-size: 11px; font-family: monospace; color: var(--text-muted); background: var(--bg-surface-elevated); padding: 8px 12px; border-radius: var(--radius-sm);">
              Ed25519 Seal Hash: ${presentation.credential_hash?.substring(0, 32)}...
            </div>
          </div>
        `;

        // Update Share QR
        if (qrImg && shareExportCard) {
          qrImg.src = `/api/v1/mock-registry/qr?text=${encodeURIComponent(targetCredId)}`;
          shareExportCard.style.display = 'block';
        }

        showToast({
          type: 'success',
          message: 'Zero-Exposure verification simulation completed successfully.'
        });

      } catch (err) {
        showToast({
          type: 'error',
          message: `Simulation error: ${err.message}`
        });
        simOutput.innerHTML = `
          <div style="padding: 20px; color: var(--danger); text-align: center;">
            Failed to simulate verification: ${err.message}
          </div>
        `;
      } finally {
        generateBtn.disabled = false;
        generateBtn.innerHTML = `<svg class="icon"><use href="vendor/lucide-sprite.svg#qr-code"></use></svg> Generate & Simulate Verification`;
      }
    });
  }

  // Copy JSON handler
  const copyBtn = container.querySelector('#btn-copy-presentation');
  if (copyBtn) {
    copyBtn.addEventListener('click', () => {
      if (!currentPresentation) return;
      navigator.clipboard.writeText(JSON.stringify(currentPresentation, null, 2)).then(() => {
        showToast({
          type: 'success',
          message: 'Presentation JSON copied to clipboard!'
        });
      });
    });
  }
}
