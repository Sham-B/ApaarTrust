/**
 * Student DigiLocker-Style Digital ID & Record Page
 */

import { api } from '../api.js';
import { store } from '../store.js';
import { renderAppShell } from '../ui/AppShell.js';
import { renderStatusPill } from '../ui/StatusPill.js';
import { showToast } from '../ui/Toast.js';

export async function renderStudentRecord(container) {
  const { persona } = store.getState();
  const token = persona?.student_token || persona?.token || 'tok_rohan_sharma';

  let recordData = null;
  let loading = true;
  let errorMsg = null;

  try {
    recordData = await api.getStudentRecord(token);
    loading = false;
  } catch (err) {
    loading = false;
    errorMsg = err.message || 'Failed to load student record';
  }

  const s = recordData?.student || {
    name: 'Rohan Aditya Sharma',
    apaar_masked: 'XXXX-XXXX-1098',
    dob: '2004-06-15',
    gender: 'Male',
    social_category: 'General',
    programme: 'B.Tech Computer Science and Engineering',
    institution_name: 'Aryabhata Institute of Technology',
    institution_id: '1-1090123456',
    student_id: 'AIT-2024-CSE-042',
    enrolment_status: 'Active',
    academic_year: '2024-25',
    admission_quota: 'State Quota'
  };

  const credId = recordData?.credential_id;

  const contentHtml = `
    <div class="page-container">
      <div class="page-header">
        <div class="page-header-title">
          <h1>My Student Record & Digital ID</h1>
          <p class="page-header-subtitle">
            Your official academic identity secured by AICTE ApaarTrust. Fully controlled by your sovereign consent.
          </p>
        </div>
        <div class="page-header-actions">
          <a href="#/student/share" class="btn btn-primary">
            <svg class="icon"><use href="vendor/lucide-sprite.svg#share-2"></use></svg>
            Share Credential
          </a>
        </div>
      </div>

      ${errorMsg ? `
        <div class="toast toast-error" style="position: static; margin-bottom: 24px;">
          <svg class="icon"><use href="vendor/lucide-sprite.svg#alert-triangle"></use></svg>
          <div class="toast-content"><div class="toast-title">Error</div><div class="toast-message">${errorMsg}</div></div>
        </div>
      ` : ''}

      <div class="grid grid-2" style="gap: 32px; align-items: start; margin-bottom: 32px;">
        <!-- DigiLocker / Citizen Style Digital ID Card -->
        <div>
          <div class="card" style="
            background: linear-gradient(135deg, #0d235c 0%, #14307a 60%, #1e429f 100%);
            color: #ffffff;
            border-radius: var(--radius-lg);
            padding: 24px;
            box-shadow: 0 12px 32px rgba(20, 48, 122, 0.25);
            position: relative;
            overflow: hidden;
            border: 1px solid rgba(255, 255, 255, 0.15);
          ">
            <!-- Subtle Indian tricolor strip header -->
            <div style="position: absolute; top: 0; left: 0; right: 0; height: 5px; display: flex;">
              <div style="flex: 1; background: #e8731a;"></div>
              <div style="flex: 1; background: #ffffff;"></div>
              <div style="flex: 1; background: #138808;"></div>
            </div>

            <!-- Card Top Header -->
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; padding-top: 6px;">
              <div style="display: flex; align-items: center; gap: 10px;">
                <div style="width: 34px; height: 34px; border-radius: 8px; background: rgba(255, 255, 255, 0.15); display: flex; align-items: center; justify-content: center;">
                  <svg class="icon" style="width: 20px; height: 20px; color: #ffffff;"><use href="vendor/lucide-sprite.svg#shield-check"></use></svg>
                </div>
                <div>
                  <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.8px; opacity: 0.85;">Ministry of Education &bull; AICTE</div>
                  <div style="font-weight: 700; font-size: 14px; letter-spacing: 0.5px;">APAAR DIGITAL STUDENT ID</div>
                </div>
              </div>
              <span class="badge" style="background: rgba(19, 136, 8, 0.3); color: #86efac; border: 1px solid rgba(19, 136, 8, 0.5); font-weight: 600;">
                ACTIVE ENROLMENT
              </span>
            </div>

            <!-- Card Body with Avatar, Student Info, and QR Seal -->
            <div style="display: grid; grid-template-columns: 80px 1fr auto; gap: 20px; align-items: center; margin-bottom: 24px;">
              <!-- Student Avatar Silhouette -->
              <div style="width: 80px; height: 96px; border-radius: 8px; background: rgba(255, 255, 255, 0.1); border: 2px solid rgba(255, 255, 255, 0.2); display: flex; flex-direction: column; align-items: center; justify-content: center;">
                <svg class="icon" style="width: 44px; height: 44px; opacity: 0.8; color: #ffffff;"><use href="vendor/lucide-sprite.svg#user"></use></svg>
                <span style="font-size: 9px; opacity: 0.7; margin-top: 4px; text-transform: uppercase;">PHOTO</span>
              </div>

              <!-- Primary Details -->
              <div>
                <div style="font-size: 18px; font-weight: 700; color: #ffffff; margin-bottom: 4px;">
                  ${s.name}
                </div>
                <div style="font-size: 13px; color: rgba(255, 255, 255, 0.85); margin-bottom: 2px;">
                  ${s.programme}
                </div>
                <div style="font-size: 12px; color: rgba(255, 255, 255, 0.7); margin-bottom: 8px;">
                  ${s.institution_name}
                </div>
                <div style="display: flex; gap: 12px; font-size: 12px; opacity: 0.9;">
                  <span>DOB: <strong>${s.dob}</strong></span>
                  <span>Gender: <strong>${s.gender}</strong></span>
                </div>
              </div>

              <!-- Signed QR Seal -->
              <div style="background: #ffffff; padding: 6px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.2); text-align: center;">
                <img src="/api/v1/mock-registry/qr?text=APAAR:${s.apaar_masked}" alt="QR Seal" style="width: 72px; height: 72px; display: block;" />
                <span style="font-size: 8px; color: #1e293b; font-weight: 700; display: block; margin-top: 2px;">VERIFIED</span>
              </div>
            </div>

            <!-- Card Bottom Bar: Masked APAAR ID -->
            <div style="background: rgba(0, 0, 0, 0.2); margin: 0 -24px -24px -24px; padding: 14px 24px; display: flex; justify-content: space-between; align-items: center; border-top: 1px solid rgba(255, 255, 255, 0.1);">
              <div>
                <div style="font-size: 10px; text-transform: uppercase; opacity: 0.7; letter-spacing: 0.5px;">Permanent APAAR Number</div>
                <div style="font-family: monospace; font-size: 16px; font-weight: 700; letter-spacing: 2px; color: #f8fafc;">
                  ${s.apaar_masked}
                </div>
              </div>
              <div style="text-align: right;">
                <div style="font-size: 10px; text-transform: uppercase; opacity: 0.7; letter-spacing: 0.5px;">Institutional ID</div>
                <div style="font-size: 13px; font-weight: 600; font-family: monospace;">
                  ${s.student_id}
                </div>
              </div>
            </div>
          </div>

          <div style="margin-top: 16px; font-size: 12px; color: var(--text-muted); display: flex; align-items: center; gap: 6px;">
            <svg class="icon" style="color: var(--success);"><use href="vendor/lucide-sprite.svg#lock"></use></svg>
            Zero Exposure Protected: Your 12-digit plaintext APAAR number is never revealed directly to third-party verifiers.
          </div>
        </div>

        <!-- Details Grid & Quick Navigation -->
        <div>
          <div class="card" style="margin-bottom: 24px;">
            <h3 style="margin: 0 0 16px 0; font-size: 16px; display: flex; align-items: center; gap: 8px;">
              <svg class="icon" style="color: var(--primary);"><use href="vendor/lucide-sprite.svg#file-text"></use></svg>
              Enrolment Specifications
            </h3>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
              <div>
                <div style="font-size: 12px; color: var(--text-muted);">Academic Year</div>
                <div style="font-weight: 600; font-size: 14px; margin-top: 2px;">${s.academic_year || '2024-25'}</div>
              </div>
              <div>
                <div style="font-size: 12px; color: var(--text-muted);">Admission Quota</div>
                <div style="font-weight: 600; font-size: 14px; margin-top: 2px;"><span class="badge">${s.admission_quota || 'State Merit'}</span></div>
              </div>
              <div>
                <div style="font-size: 12px; color: var(--text-muted);">Institution AICTE ID</div>
                <div style="font-weight: 600; font-size: 14px; margin-top: 2px; font-family: monospace;">${s.institution_id}</div>
              </div>
              <div>
                <div style="font-size: 12px; color: var(--text-muted);">Affirmative Action / Category</div>
                <div style="font-weight: 600; font-size: 14px; margin-top: 2px;">${s.social_category || 'General'}</div>
              </div>
              <div>
                <div style="font-size: 12px; color: var(--text-muted);">Cryptographic Identity Token</div>
                <div style="font-family: monospace; font-size: 11px; margin-top: 2px; color: var(--text-muted); word-break: break-all;">
                  ${token}
                </div>
              </div>
              <div>
                <div style="font-size: 12px; color: var(--text-muted);">Digital Credential Status</div>
                <div style="margin-top: 4px;">
                  ${renderStatusPill({
                    status: recordData?.credential_id ? 'valid' : 'pending',
                    label: recordData?.credential_status || 'Active Issued'
                  })}
                </div>
              </div>
            </div>
          </div>

          <!-- Action Hub -->
          <div class="card" style="background: var(--bg-surface-elevated);">
            <h3 style="margin: 0 0 12px 0; font-size: 15px;">Privacy & Verifier Hub</h3>
            <p style="font-size: 13px; color: var(--text-muted); margin-bottom: 16px; line-height: 1.5;">
              You have sovereign control over who can verify your student credentials. You can selectively disclose your degree while withholding sensitive personal attributes.
            </p>
            <div style="display: flex; gap: 12px; flex-wrap: wrap;">
              <a href="#/student/consent" class="btn btn-secondary btn-sm">
                <svg class="icon"><use href="vendor/lucide-sprite.svg#sliders"></use></svg>
                Manage Field Consent
              </a>
              <a href="#/student/activity" class="btn btn-secondary btn-sm">
                <svg class="icon"><use href="vendor/lucide-sprite.svg#activity"></use></svg>
                Who Viewed My Record
              </a>
              ${credId ? `
                <a href="/api/v1/credentials/${credId}/certificate.pdf" target="_blank" class="btn btn-ghost btn-sm">
                  <svg class="icon"><use href="vendor/lucide-sprite.svg#download"></use></svg>
                  Sample Certificate (PDF)
                </a>
              ` : ''}
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  renderAppShell(container, contentHtml, 'record');
}
