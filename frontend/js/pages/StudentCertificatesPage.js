/**
 * Student Certificates Page
 */

import { api } from '../api.js';
import { store } from '../store.js';
import { renderAppShell } from '../ui/AppShell.js';
import { renderStatusPill } from '../ui/StatusPill.js';
import { renderEmptyState } from '../ui/EmptyState.js';

export async function renderStudentCertificates(container) {
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
    errorMsg = err.message || 'Failed to load certificates';
  }

  const credId = recordData?.credential_id;
  const s = recordData?.student || {};

  const contentHtml = `
    <div class="page-container">
      <div class="page-header">
        <div class="page-header-title">
          <h1>My Sample Certificates & Credentials</h1>
          <p class="page-header-subtitle">
            Digitally signed verifiable credentials with embedded machine-readable QR seals.
          </p>
        </div>
        <div class="page-header-actions">
          <a href="#/student/share" class="btn btn-primary">
            <svg class="icon"><use href="vendor/lucide-sprite.svg#share-2"></use></svg>
            Share with Verifier
          </a>
        </div>
      </div>

      ${errorMsg ? `
        <div class="toast toast-error" style="position: static; margin-bottom: 24px;">
          <svg class="icon"><use href="vendor/lucide-sprite.svg#alert-triangle"></use></svg>
          <div class="toast-content"><div class="toast-title">Error</div><div class="toast-message">${errorMsg}</div></div>
        </div>
      ` : ''}

      ${!credId ? renderEmptyState({
        iconName: 'award',
        title: 'No credential issued yet',
        description: 'Your institution has not published a verifiable digital credential for this academic session yet.',
        actionHtml: '<a href="#/student/record" class="btn btn-secondary">Check student record</a>'
      }) : `
        <div class="grid grid-2" style="gap: 32px; align-items: start;">
          <!-- Sample Certificate Document Card -->
          <div class="card" style="
            border: 2px solid var(--border-color);
            border-radius: var(--radius-lg);
            padding: 32px;
            background: #ffffff;
            color: #0f172a;
            box-shadow: 0 10px 30px rgba(0,0,0,0.06);
            position: relative;
          ">
            <!-- Decorative Border Accent -->
            <div style="border: 1px solid #cbd5e1; padding: 24px; border-radius: var(--radius-md); text-align: center;">
              <!-- Header -->
              <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 1.5px; color: #64748b; font-weight: 700; margin-bottom: 4px;">
                ALL INDIA COUNCIL FOR TECHNICAL EDUCATION
              </div>
              <div style="font-size: 20px; font-weight: 800; color: #14307a; letter-spacing: 0.5px; margin-bottom: 8px;">
                SAMPLE CERTIFICATE OF VERIFIED ENROLMENT
              </div>
              <div style="font-size: 12px; color: #64748b; margin-bottom: 20px;">
                APAAR TRUST DIGITAL VERIFICATION INFRASTRUCTURE
              </div>

              <div style="height: 1px; background: #e2e8f0; width: 80%; margin: 0 auto 20px auto;"></div>

              <div style="font-size: 13px; color: #475569; margin-bottom: 8px;">
                This certifies that the academic enrolment of
              </div>

              <div style="font-size: 22px; font-weight: 800; color: #0f172a; margin-bottom: 6px;">
                ${s.name || 'Rohan Aditya Sharma'}
              </div>

              <div style="font-size: 13px; color: #475569; margin-bottom: 12px;">
                has been validated and enrolled in <strong>${s.programme || 'B.Tech Computer Science and Engineering'}</strong> at
              </div>

              <div style="font-size: 15px; font-weight: 700; color: #14307a; margin-bottom: 20px;">
                ${s.institution_name || 'Aryabhata Institute of Technology'}
              </div>

              <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-top: 24px; padding-top: 16px; border-top: 1px dashed #cbd5e1; text-align: left;">
                <div>
                  <div style="font-size: 10px; color: #64748b; text-transform: uppercase;">Permanent APAAR ID</div>
                  <div style="font-family: monospace; font-size: 14px; font-weight: 700; color: #1e293b;">${s.apaar_masked || 'XXXX-XXXX-1098'}</div>
                  <div style="font-size: 10px; color: #64748b; margin-top: 4px;">Session: ${s.academic_year || '2024-25'}</div>
                </div>

                <!-- Machine readable QR -->
                <div style="text-align: center;">
                  <img src="/api/v1/mock-registry/qr?text=${credId}" alt="Certificate QR" style="width: 72px; height: 72px; display: block;" />
                  <span style="font-size: 8px; color: #64748b; font-weight: 600;">ED25519 SEAL</span>
                </div>
              </div>
            </div>

            <!-- Disclaimer footnote per content rules -->
            <div style="margin-top: 12px; text-align: center; font-size: 11px; color: #94a3b8;">
              Sample certificate for demonstration. Issued under synthetic test data rules.
            </div>
          </div>

          <!-- Credential Metadata & Actions -->
          <div>
            <div class="card" style="margin-bottom: 24px;">
              <h3 style="margin: 0 0 16px 0; font-size: 16px; display: flex; align-items: center; gap: 8px;">
                <svg class="icon" style="color: var(--primary);"><use href="vendor/lucide-sprite.svg#shield-check"></use></svg>
                Cryptographic Seal Details
              </h3>

              <div style="display: flex; flex-direction: column; gap: 12px; font-size: 13px;">
                <div style="display: flex; justify-content: space-between;">
                  <span style="color: var(--text-muted);">Credential Identifier:</span>
                  <code style="font-family: monospace;">${credId}</code>
                </div>
                <div style="display: flex; justify-content: space-between;">
                  <span style="color: var(--text-muted);">Issuer:</span>
                  <strong>AICTE ApaarTrust Authority</strong>
                </div>
                <div style="display: flex; justify-content: space-between;">
                  <span style="color: var(--text-muted);">Signature Scheme:</span>
                  <span class="badge">Ed25519 (256-bit Elliptic Curve)</span>
                </div>
                <div style="display: flex; justify-content: space-between;">
                  <span style="color: var(--text-muted);">Field Commitments:</span>
                  <strong>8 Salted Hashes (SD-JWT)</strong>
                </div>
                <div style="display: flex; justify-content: space-between;">
                  <span style="color: var(--text-muted);">Verification Status:</span>
                  ${renderStatusPill({ status: 'valid', label: 'Cryptographically Verified' })}
                </div>
              </div>

              <div style="margin-top: 24px; display: flex; gap: 12px; flex-direction: column;">
                <a href="/api/v1/credentials/${credId}/certificate.pdf" target="_blank" class="btn btn-primary" style="justify-content: center;">
                  <svg class="icon"><use href="vendor/lucide-sprite.svg#download"></use></svg>
                  Download Sample Certificate (PDF)
                </a>
                <a href="#/verify" class="btn btn-secondary" style="justify-content: center;">
                  <svg class="icon"><use href="vendor/lucide-sprite.svg#check-square"></use></svg>
                  Test in Public Verifier
                </a>
              </div>
            </div>

            <!-- Privacy reassurance -->
            <div class="card" style="background: var(--bg-surface-elevated);">
              <div style="font-size: 12px; color: var(--text-muted); line-height: 1.5;">
                <strong style="color: var(--text-color);">Offline Proof:</strong> Even if AICTE servers are completely offline, any public verifier can verify the authenticity of this PDF certificate by mathematically checking the embedded Ed25519 cryptographic signature.
              </div>
            </div>
          </div>
        </div>
      `}
    </div>
  `;

  renderAppShell(container, contentHtml, 'certificates');
}
