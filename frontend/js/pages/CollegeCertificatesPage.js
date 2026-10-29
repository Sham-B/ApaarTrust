/**
 * College Certificate Studio Page
 * Live certificate preview, signed QR seal, PDF download
 */

import { api } from '../api.js';
import { renderAppShell, bindAppShellEvents } from '../ui/AppShell.js';
import { iconHtml } from '../ui/icons.js';
import { statusPill } from '../ui/StatusPill.js';

export async function renderCollegeCertificates(container) {
  let students = [];
  try {
    students = await api.get('/api/v1/institutions/1-1090123456/students');
  } catch (err) {
    console.error('Failed to load students for certificates:', err);
  }

  const sampleStudent = students[0] || {
    id: 1,
    name: 'Rohan Aditya Sharma',
    student_id: 'CSE-24-042',
    programme: 'B.Tech Computer Science and Engineering',
    apaar_id: 'XXXX-XXXX-1100',
  };

  const contentHtml = `
    <div class="page-header">
      <div class="page-header-text">
        <h1>Digital Certificate Studio</h1>
        <p>Issue, preview, and download cryptographically signed AICTE student enrolment certificates with embedded QR seals.</p>
      </div>
      <div class="page-actions">
        <a href="${typeof window.apiUrl === 'function' ? window.apiUrl(`/api/v1/credentials/cred_demo_01/certificate.pdf`) : '/api/v1/credentials/cred_demo_01/certificate.pdf'}" class="btn btn-primary btn-sm" id="btnDownloadCert" target="_blank">
          ${iconHtml('download', 'icon-sm')} Download sample certificate PDF
        </a>
      </div>
    </div>

    <!-- Certificate Studio Layout -->
    <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 24px;" class="cert-split-grid">
      <!-- Live Certificate Visual Preview -->
      <div class="card" style="padding: var(--space-6); background: #ffffff; border: 2px solid var(--border-main); box-shadow: var(--shadow-lg);">
        <div style="border: 2px solid #14307a; padding: var(--space-6); position: relative; border-radius: 4px;">
          <!-- Corner Accents -->
          <div style="text-align: center; margin-bottom: var(--space-6);">
            <div style="font-size: 0.8rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: var(--navy);">
              All India Council for Technical Education
            </div>
            <h2 style="font-size: 1.5rem; color: var(--navy); margin: 6px 0;">SAMPLE ENROLMENT CERTIFICATE</h2>
            <div style="font-size: 0.75rem; color: var(--text-muted);">
              Issued under the National APAAR Student Identity Framework
            </div>
          </div>

          <div style="margin: 24px 0; font-size: 0.95rem; line-height: 1.8; color: var(--slate-800);">
            This is to certify that <strong>${sampleStudent.name}</strong>, holder of masked APAAR identity
            <code>${sampleStudent.apaar_id}</code> and Institutional Roll ID <strong>${sampleStudent.student_id}</strong>,
            is actively admitted to the approved full-time degree programme:
            <div style="margin: 12px 0; padding: 10px; background: var(--slate-50); border-left: 3px solid var(--saffron); font-weight: 600; color: var(--navy);">
              ${sampleStudent.programme}
            </div>
            at <strong>Aryabhata Institute of Technology (AICTE PID: 1-1090123456)</strong> for Academic Year <strong>2024-25</strong>.
          </div>

          <!-- Bottom Footer: QR Seal & Authority Signatures -->
          <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-top: 36px; padding-top: 16px; border-top: 1px dashed var(--slate-300);">
            <!-- QR Code Box -->
            <div style="display: flex; align-items: center; gap: 12px;">
              <div style="width: 80px; height: 80px; border: 1px solid #000; padding: 4px; display: flex; align-items: center; justify-content: center; background: #fff;">
                <svg style="width: 68px; height: 68px;" aria-hidden="true"><use href="vendor/lucide-sprite.svg#icon-qr-code"></use></svg>
              </div>
              <div style="font-size: 0.72rem; color: var(--text-muted); max-width: 140px;">
                Scan with any standard QR camera or verify at <code>#/verify</code>.
              </div>
            </div>

            <!-- Signatures -->
            <div style="text-align: right; font-size: 0.78rem;">
              <div style="font-family: 'Times New Roman', serif; font-size: 1.2rem; font-style: italic; color: var(--navy);">
                K. S. Verma
              </div>
              <div>Registrar, Aryabhata Institute</div>
              <div style="color: var(--text-subtle);">Digitally Sealed with Ed25519</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Certificate Metadata & Controls -->
      <div style="display: flex; flex-direction: column; gap: var(--space-4);">
        <div class="card">
          <div class="card-header">
            <h3>Cryptographic Seal Specs</h3>
          </div>
          <div class="card-body" style="font-size: 0.85rem; display: flex; flex-direction: column; gap: 10px;">
            <div>
              <small>Signature Scheme</small>
              <div style="font-weight: 600;">Ed25519 Pure Edwards Curve</div>
            </div>
            <div>
              <small>Selective Disclosure</small>
              <div style="font-weight: 600;">SD-JWT-inspired Salted Commitments</div>
            </div>
            <div>
              <small>Sample Certificate Notice</small>
              <div style="font-size: 0.78rem; color: var(--text-muted); margin-top: 2px;">
                Demonstration sample certificate rendered via ReportLab with machine-readable verification payload.
              </div>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <h3>Issue New Certificate</h3>
          </div>
          <div class="card-body">
            <p style="font-size: 0.82rem; color: var(--text-muted); margin-bottom: var(--space-3);">
              Select any student from your admitted cohort to issue an official verifiable credential:
            </p>
            <select class="form-select" id="certStudentSelect" style="margin-bottom: var(--space-3);">
              ${students.slice(0, 10).map((s) => `<option value="${s.id}">${s.name} (${s.student_id})</option>`).join('')}
            </select>
            <button class="btn btn-primary btn-sm" id="btnIssueCert" style="width: 100%;">
              ${iconHtml('award', 'icon-sm')} Generate & Sign Credential
            </button>
          </div>
        </div>
      </div>
    </div>
  `;

  const breadcrumbs = [
    { label: 'Overview', href: '#/college/overview' },
    { label: 'Certificates', href: '#/college/certificates' },
  ];

  container.innerHTML = renderAppShell(contentHtml, breadcrumbs);
  bindAppShellEvents();

  const issueBtn = document.getElementById('btnIssueCert');
  if (issueBtn) {
    issueBtn.addEventListener('click', async () => {
      const select = document.getElementById('certStudentSelect');
      const studentId = select.value;
      try {
        issueBtn.disabled = true;
        await api.post(`/api/v1/credentials/issue?student_id=${studentId}`, {});
        window.dispatchEvent(
          new CustomEvent('apaar:toast', {
            detail: { type: 'success', message: 'Verifiable credential issued and signed with Ed25519 seal!' },
          })
        );
      } catch (err) {
        window.dispatchEvent(new CustomEvent('apaar:toast', { detail: { type: 'error', message: err.message || 'Issue failed.' } }));
      } finally {
        issueBtn.disabled = false;
      }
    });
  }
}
