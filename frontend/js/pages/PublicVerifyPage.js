/**
 * Public Verifier Page (#/verify) - No Login Required
 */

import { api } from '../api.js';
import { previewManager } from '../preview.js';
import { getVerifierSampleResult } from '../fixtures.js';
import { renderStatusPill } from '../ui/StatusPill.js';
import { showToast } from '../ui/Toast.js';

export async function renderPublicVerify(container) {
  const contentHtml = `
    <!-- Standalone Clean Marketing / Public Verifier Shell Header -->
    <header style="background: var(--bg-surface); border-bottom: 1px solid var(--border-color); position: sticky; top: 0; z-index: 100;">
      <div style="max-width: 1100px; margin: 0 auto; padding: 14px 20px; display: flex; justify-content: space-between; align-items: center;">
        <a href="#/" style="display: flex; align-items: center; gap: 10px; text-decoration: none; color: inherit;">
          <div style="width: 32px; height: 32px; border-radius: 8px; background: var(--primary); display: flex; align-items: center; justify-content: center; color: white;">
            <svg class="icon" style="width: 20px; height: 20px;"><use href="vendor/lucide-sprite.svg#shield-check"></use></svg>
          </div>
          <span style="font-size: 18px; font-weight: 700; color: var(--primary); letter-spacing: -0.5px;">ApaarTrust</span>
          <span class="badge" style="background: rgba(20, 48, 122, 0.08); color: var(--primary); font-weight: 600;">Public Verifier</span>
        </a>

        <div style="display: flex; align-items: center; gap: 16px;">
          <a href="#/" class="btn btn-ghost btn-sm">
            <svg class="icon"><use href="vendor/lucide-sprite.svg#arrow-left"></use></svg>
            Back to Home
          </a>
        </div>
      </div>
    </header>

    <main style="max-width: 900px; margin: 0 auto; padding: 40px 20px 80px 20px;">
      <!-- Hero Header -->
      <div style="text-align: center; margin-bottom: 40px;">
        <span class="badge" style="background: rgba(19, 136, 8, 0.1); color: var(--success); font-weight: 600; margin-bottom: 12px; display: inline-flex;">
          Cryptographic Verification Engine
        </span>
        <h1 style="font-size: 32px; font-weight: 800; letter-spacing: -0.5px; margin: 0 0 12px 0;">
          Verify Academic Credentials Instantly
        </h1>
        <p style="font-size: 16px; color: var(--text-muted); max-width: 600px; margin: 0 auto; line-height: 1.5;">
          Upload a certificate PDF, scan an ApaarTrust QR seal, or paste a verifiable presentation to mathematically confirm authenticity.
        </p>
      </div>

      <!-- Sample Test Cases Bar -->
      <div class="card" style="margin-bottom: 24px; background: var(--bg-surface-elevated); padding: 16px 20px;">
        <div style="font-size: 12px; font-weight: 700; text-transform: uppercase; color: var(--text-muted); margin-bottom: 10px; display: flex; align-items: center; gap: 6px;">
          <svg class="icon"><use href="vendor/lucide-sprite.svg#sparkles"></use></svg>
          Try Sample Credentials (All 5 Verification Outcomes):
        </div>
        <div style="display: flex; gap: 10px; flex-wrap: wrap;">
          <button class="btn btn-secondary btn-sm btn-sample" data-sample="genuine">
            <svg class="icon" style="color: var(--success);"><use href="vendor/lucide-sprite.svg#check-circle-2"></use></svg>
            1. Genuine (Active)
          </button>
          <button class="btn btn-secondary btn-sm btn-sample" data-sample="revoked">
            <svg class="icon" style="color: var(--danger);"><use href="vendor/lucide-sprite.svg#shield-off"></use></svg>
            2. Revoked (Consent Withdrawn)
          </button>
          <button class="btn btn-secondary btn-sm btn-sample" data-sample="expired">
            <svg class="icon" style="color: var(--warning);"><use href="vendor/lucide-sprite.svg#clock"></use></svg>
            3. Expired (Past Validity)
          </button>
          <button class="btn btn-secondary btn-sm btn-sample" data-sample="tampered">
            <svg class="icon" style="color: var(--danger);"><use href="vendor/lucide-sprite.svg#alert-octagon"></use></svg>
            4. Tampered (Broken Signature)
          </button>
          <button class="btn btn-secondary btn-sm btn-sample" data-sample="not_found">
            <svg class="icon" style="color: var(--text-muted);"><use href="vendor/lucide-sprite.svg#help-circle"></use></svg>
            5. Not Found (Unregistered)
          </button>
        </div>
      </div>

      <!-- Verification Input Card -->
      <div class="card" style="margin-bottom: 32px; border: 2px solid var(--border-color); box-shadow: var(--shadow-md);">
        <!-- Mode Tabs -->
        <div class="tabs" style="margin-bottom: 20px;">
          <button class="tab-button active" id="tab-btn-file">
            <svg class="icon"><use href="vendor/lucide-sprite.svg#file-text"></use></svg>
            Upload Certificate PDF / Image
          </button>
          <button class="tab-button" id="tab-btn-text">
            <svg class="icon"><use href="vendor/lucide-sprite.svg#code"></use></svg>
            Paste Presentation JSON / Code
          </button>
        </div>

        <!-- Mode 1: File Dropzone -->
        <div id="mode-file-container">
          <div id="verify-dropzone" class="file-dropzone" style="padding: 40px 20px;">
            <input type="file" id="verify-file-input" accept=".pdf,image/png,image/jpeg" style="display: none;" />
            <div style="width: 48px; height: 48px; border-radius: 12px; background: rgba(20, 48, 122, 0.08); display: flex; align-items: center; justify-content: center; margin: 0 auto 16px auto; color: var(--primary);">
              <svg class="icon" style="width: 24px; height: 24px;"><use href="vendor/lucide-sprite.svg#upload-cloud"></use></svg>
            </div>
            <div style="font-weight: 600; font-size: 15px; margin-bottom: 4px;">
              Drag & Drop Certificate or Click to Browse
            </div>
            <div style="font-size: 13px; color: var(--text-muted); margin-bottom: 12px;">
              Supports Sample Certificate PDF or QR code images (PNG, JPEG)
            </div>
            <button type="button" class="btn btn-secondary btn-sm" id="btn-browse-file">
              Select Document
            </button>
          </div>
        </div>

        <!-- Mode 2: Paste JSON -->
        <div id="mode-text-container" style="display: none;">
          <textarea id="verify-text-input" class="input" style="height: 140px; font-family: monospace; font-size: 12px; margin-bottom: 12px;" placeholder="Paste SD-JWT presentation JSON or credential ID token here..."></textarea>
          <button id="btn-verify-text" class="btn btn-primary" style="width: 100%; justify-content: center;">
            <svg class="icon"><use href="vendor/lucide-sprite.svg#check-square"></use></svg>
            Verify Cryptographic Presentation
          </button>
        </div>
      </div>

      <!-- Verification Result Display (Empty / Loading / Result) -->
      <div id="verify-result-container" style="display: none; margin-bottom: 40px;"></div>

      <!-- Explainer Accordion -->
      <div class="card" style="background: var(--bg-surface-elevated);">
        <h3 style="margin: 0 0 12px 0; font-size: 16px; display: flex; align-items: center; gap: 8px;">
          <svg class="icon" style="color: var(--primary);"><use href="vendor/lucide-sprite.svg#info"></use></svg>
          How Public Verification Works in ApaarTrust
        </h3>
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-top: 16px; font-size: 13px;">
          <div>
            <div style="font-weight: 700; color: var(--primary); margin-bottom: 4px;">1. Mathematical Proof</div>
            <div style="color: var(--text-muted); line-height: 1.5;">
              Each credential contains an Ed25519 digital signature generated by the AICTE authority. The signature cryptographically binds all student attributes.
            </div>
          </div>
          <div>
            <div style="font-weight: 700; color: var(--primary); margin-bottom: 4px;">2. Zero Exposure</div>
            <div style="color: var(--text-muted); line-height: 1.5;">
              Sensitive attributes (like Date of Birth or Social Category) are blinded with cryptographic salts. Verifiers verify authenticity without seeing hidden data.
            </div>
          </div>
          <div>
            <div style="font-weight: 700; color: var(--primary); margin-bottom: 4px;">3. Sovereign Consent</div>
            <div style="color: var(--text-muted); line-height: 1.5;">
              Verification is continuously governed by the student's consent ledger. If a student revokes consent, subsequent verification attempts fail instantly.
            </div>
          </div>
        </div>
      </div>
    </main>
  `;

  container.innerHTML = contentHtml;

  // Tab switching
  const tabFile = container.querySelector('#tab-btn-file');
  const tabText = container.querySelector('#tab-btn-text');
  const modeFile = container.querySelector('#mode-file-container');
  const modeText = container.querySelector('#mode-text-container');

  tabFile.addEventListener('click', () => {
    tabFile.classList.add('active');
    tabText.classList.remove('active');
    modeFile.style.display = 'block';
    modeText.style.display = 'none';
  });

  tabText.addEventListener('click', () => {
    tabText.classList.add('active');
    tabFile.classList.remove('active');
    modeText.style.display = 'block';
    modeFile.style.display = 'none';
  });

  // Dropzone file handling
  const dropzone = container.querySelector('#verify-dropzone');
  const fileInput = container.querySelector('#verify-file-input');
  const browseBtn = container.querySelector('#btn-browse-file');
  const resultContainer = container.querySelector('#verify-result-container');

  browseBtn.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) handleFileUpload(e.target.files[0]);
  });

  dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('drag-active');
  });

  dropzone.addEventListener('dragleave', () => dropzone.classList.remove('drag-active'));
  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('drag-active');
    if (e.dataTransfer.files.length > 0) handleFileUpload(e.dataTransfer.files[0]);
  });

  async function handleFileUpload(file) {
    showLoadingResult(`Decoding and verifying ${file.name}...`);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('verifier_type', 'Public Document Upload');

      const res = await fetch('/api/v1/verify/upload', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      renderVerificationResult(data);
    } catch (err) {
      renderVerificationResult({
        status: 'tampered',
        genuine: false,
        message: `Verification request failed: ${err.message}`,
        disclosed_fields: [],
        withheld_fields: []
      });
    }
  }

  // Paste text handling
  const verifyTextBtn = container.querySelector('#btn-verify-text');
  const textInput = container.querySelector('#verify-text-input');

  verifyTextBtn.addEventListener('click', async () => {
    const raw = textInput.value.trim();
    if (!raw) {
      showToast({ type: 'warning', message: 'Please paste a presentation JSON or credential ID first.' });
      return;
    }

    showLoadingResult('Verifying cryptographic signature and salt commitments...');
    try {
      let presentationObj = null;
      try {
        presentationObj = JSON.parse(raw);
      } catch {
        // Assume it's a direct credential ID, generate presentation
        presentationObj = await api.get(`/api/v1/credentials/${encodeURIComponent(raw)}/presentation?purpose=Public%20Verification`);
      }

      const res = await api.post('/api/v1/verify/presentation?verifier_type=Public%20Verifier', presentationObj);
      renderVerificationResult(res);
    } catch (err) {
      renderVerificationResult({
        status: 'tampered',
        genuine: false,
        message: `Verification failed: ${err.message}`,
        disclosed_fields: [],
        withheld_fields: []
      });
    }
  });

  // Sample Demos Handlers
  let activeSampleReq = 0;
  container.querySelectorAll('.btn-sample').forEach(btn => {
    btn.addEventListener('click', async () => {
      const sample = btn.dataset.sample;
      const reqId = ++activeSampleReq;
      showLoadingResult(`Evaluating sample outcome: ${sample}...`);

      try {
        if (sample === 'genuine') {
          if (previewManager.isActive()) {
            const sampleRes = getVerifierSampleResult('genuine');
            if (reqId !== activeSampleReq) return;
            renderVerificationResult(sampleRes);
            return;
          }
          const pres = await api.get('/api/v1/credentials/cred-demo-aicte-2026/presentation?purpose=Graduate%20Hiring');
          if (reqId !== activeSampleReq) return;
          const res = await api.post('/api/v1/verify/presentation?verifier_type=Sample%20Genuine%20Demo', pres);
          if (reqId !== activeSampleReq) return;
          renderVerificationResult(res);
        } else {
          const sampleRes = getVerifierSampleResult(sample);
          if (reqId !== activeSampleReq) return;
          if (sampleRes) {
            renderVerificationResult(sampleRes);
          }
        }
      } catch (err) {
        showToast({ type: 'error', message: `Sample verification error: ${err.message}` });
      }
    });
  });

  function showLoadingResult(msg) {
    resultContainer.style.display = 'block';
    resultContainer.innerHTML = `
      <div class="card" style="text-align: center; padding: 40px 20px;">
        <span class="spinner" style="width: 32px; height: 32px; margin: 0 auto 16px auto; display: block;"></span>
        <div style="font-weight: 600; font-size: 15px;">${msg}</div>
        <div style="font-size: 13px; color: var(--text-muted); margin-top: 4px;">Evaluating against AICTE cryptographic roots...</div>
      </div>
    `;
    resultContainer.scrollIntoView({ behavior: 'smooth' });
  }

  function renderVerificationResult(res) {
    resultContainer.style.display = 'block';
    const isGenuine = res.status === 'genuine';
    const isRevoked = res.status === 'revoked';
    const isTampered = res.status === 'tampered';
    const isExpired = res.status === 'expired';

    const statusBannerBg = isGenuine
      ? 'rgba(19, 136, 8, 0.08)'
      : isRevoked
      ? 'rgba(198, 40, 40, 0.08)'
      : isTampered
      ? 'rgba(198, 40, 40, 0.12)'
      : 'rgba(232, 115, 26, 0.08)';

    const statusBorder = isGenuine
      ? 'var(--success)'
      : isRevoked || isTampered
      ? 'var(--danger)'
      : 'var(--warning)';

    const iconName = isGenuine
      ? 'check-circle-2'
      : isRevoked
      ? 'shield-off'
      : isTampered
      ? 'alert-octagon'
      : 'alert-triangle';

    const statusTitle = isGenuine
      ? 'GENUINE & AUTHENTIC'
      : isRevoked
      ? 'VERIFICATION BLOCKED (CONSENT REVOKED)'
      : isTampered
      ? 'TAMPERED / INVALID CREDENTIAL'
      : 'UNRECOGNIZED OR EXPIRED';

    const disclosed = res.disclosed_fields || [];
    const withheld = res.withheld_fields || [];

    resultContainer.innerHTML = `
      <div class="card" style="border: 2px solid ${statusBorder}; padding: 24px; box-shadow: var(--shadow-md);">
        <!-- Top Banner -->
        <div style="display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 20px; border-bottom: 1px solid var(--border-color); margin-bottom: 20px;">
          <div style="display: flex; align-items: center; gap: 14px;">
            <div style="width: 44px; height: 44px; border-radius: 10px; background: ${statusBannerBg}; display: flex; align-items: center; justify-content: center; color: ${statusBorder};">
              <svg class="icon" style="width: 24px; height: 24px;"><use href="vendor/lucide-sprite.svg#${iconName}"></use></svg>
            </div>
            <div>
              <div style="font-size: 18px; font-weight: 800; color: ${statusBorder}; letter-spacing: 0.5px;">
                ${statusTitle}
              </div>
              <div style="font-size: 13px; color: var(--text-muted); margin-top: 2px;">
                ${res.message || 'Credential evaluation completed.'}
              </div>
            </div>
          </div>
          <div>
            ${renderStatusPill({
              status: isGenuine ? 'valid' : 'invalid',
              label: isGenuine ? 'Ed25519 Verified' : (res.status?.toUpperCase() || 'INVALID')
            })}
          </div>
        </div>

        <!-- Disclosed vs Withheld Attributes Grid -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px;">
          <!-- Disclosed Panel -->
          <div style="background: var(--bg-surface-elevated); border-radius: var(--radius-sm); padding: 16px; border: 1px solid var(--border-color);">
            <div style="font-size: 12px; font-weight: 700; text-transform: uppercase; color: var(--success); margin-bottom: 10px; display: flex; align-items: center; gap: 6px;">
              <svg class="icon"><use href="vendor/lucide-sprite.svg#check"></use></svg>
              Verified Disclosed Attributes (${disclosed.length})
            </div>
            ${disclosed.length === 0 ? `
              <div style="font-size: 13px; color: var(--text-muted);">No attributes disclosed in this presentation.</div>
            ` : `
              <table style="width: 100%; font-size: 13px;">
                ${disclosed.map(d => `
                  <tr>
                    <td style="color: var(--text-muted); padding: 5px 0; text-transform: capitalize; width: 45%;">
                      ${d.field?.replace(/_/g, ' ') || 'Attribute'}:
                    </td>
                    <td style="font-weight: 600; padding: 5px 0; color: var(--text-color);">
                      ${d.value || '-'}
                    </td>
                  </tr>
                `).join('')}
              </table>
            `}
          </div>

          <!-- Withheld Panel -->
          <div style="background: var(--bg-surface-elevated); border-radius: var(--radius-sm); padding: 16px; border: 1px solid var(--border-color);">
            <div style="font-size: 12px; font-weight: 700; text-transform: uppercase; color: var(--text-muted); margin-bottom: 10px; display: flex; align-items: center; gap: 6px;">
              <svg class="icon"><use href="vendor/lucide-sprite.svg#lock"></use></svg>
              Withheld Attributes (${withheld.length})
            </div>
            ${withheld.length === 0 ? `
              <div style="font-size: 13px; color: var(--text-muted);">All available attributes were disclosed.</div>
            ` : `
              <div style="display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 10px;">
                ${withheld.map(w => `<span class="badge" style="background: var(--bg-surface);">${w}</span>`).join('')}
              </div>
              <div style="font-size: 12px; color: var(--text-muted); line-height: 1.5;">
                Protected by student consent. These fields were verified via salted hash commitments without disclosing raw personal data.
              </div>
            `}
          </div>
        </div>

        <!-- Technical Footnote -->
        <div style="font-size: 11px; font-family: monospace; color: var(--text-muted); display: flex; justify-content: space-between; align-items: center;">
          <span>Scheme: SD-JWT Ed25519</span>
          <span>Verified At: ${new Date().toLocaleTimeString()}</span>
        </div>
      </div>
    `;

    resultContainer.scrollIntoView({ behavior: 'smooth' });
  }
}
