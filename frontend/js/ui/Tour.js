/**
 * Coach-Mark 5-Step Guided Onboarding Tour per Role
 */

import { store } from '../store.js';
import { iconHtml } from './icons.js';

export const ROLE_TOURS = {
  Officer: [
    {
      title: 'Welcome, Officer Ananya Rao',
      description: 'ApaarTrust gives the AICTE Regulation Bureau real-time visibility over student enrolment compliance across all approved institutions with zero privacy leakage.',
      icon: 'shield-check',
    },
    {
      title: 'State Tile-Grid Map',
      description: 'The regional tile map highlights state-level compliance hotspots at a glance. Green indicates clean intake; amber/red flags pending seat caps or identity anomalies.',
      icon: 'map-pin',
    },
    {
      title: 'Automated Findings Triage',
      description: 'Findings are categorized by severity. Drill down into plain-English reasons, evidence tables, and benign hypotheses before issuing regulatory notices.',
      icon: 'inbox',
    },
    {
      title: 'Privacy-Preserving Duplicate Finder',
      description: 'Cross-institution duplicate enrolments are flagged using HMAC identity tokens. You can spot dual-institution admissions without exposing student Aadhaar/APAAR numbers.',
      icon: 'users',
    },
    {
      title: 'Immutable Cryptographic Audit Trail',
      description: 'Every inspection, ID reveal, and regulatory action is appended to a SHA-256 hash chain. You can run the live tamper-detection demo at any time.',
      icon: 'history',
    },
  ],

  Institution: [
    {
      title: 'Welcome, Aryabhata Institute Registrar',
      description: 'Manage and validate student intake against AICTE approved programmes with instant dry-run feedback before official submission.',
      icon: 'building-2',
    },
    {
      title: 'Live Sanctioned Intake Gauges',
      description: 'Interactive programme gauges track regular sanctioned seats and supernumerary quotas (TFW, EWS, FN) in real-time as admissions occur.',
      icon: 'gauge',
    },
    {
      title: '3-Step Upload & Dry-Run Wizard',
      description: 'Upload your student Excel or CSV roster. Our dry-run engine checks 14 validation rules and provides an instant error summary without saving anything to the database.',
      icon: 'upload-cloud',
    },
    {
      title: 'Actionable To-Dos with Inline Fix Guides',
      description: 'Review row-level discrepancies, date-of-birth registry mismatches, and quota overflows with clear step-by-step instructions on how to correct your source data.',
      icon: 'check-square',
    },
    {
      title: 'Verifiable Certificate Studio',
      description: 'Generate digitally sealed Sample Certificates with embedded Ed25519 QR codes that employers and government agencies can verify offline.',
      icon: 'award',
    },
  ],

  Student: [
    {
      title: 'Welcome, Rohan Aditya Sharma',
      description: 'You have complete sovereign control over your academic credentials. Your permanent APAAR number is encrypted at rest and never revealed to verifiers.',
      icon: 'user-check',
    },
    {
      title: 'DigiLocker-Style Digital ID',
      description: 'View your official academic ID card with masked identifier, active programme details, and cryptographically verified enrolment seal.',
      icon: 'credit-card',
    },
    {
      title: 'Sovereign Field-Level Consent',
      description: 'You choose exactly which data attributes (e.g. name, programme) a third party can view. You can withhold sensitive data like Date of Birth or Caste.',
      icon: 'sliders',
    },
    {
      title: 'Zero-Exposure Simulator',
      description: 'Test your credential presentations in real-time using the simulator to preview exactly what an employer or bank sees when verifying your identity.',
      icon: 'eye-off',
    },
    {
      title: 'Who Viewed My Record Timeline',
      description: 'Full transparency: every time an agency or company verifies your credential, an immutable audit entry is recorded in your activity timeline.',
      icon: 'activity',
    },
  ],
};

export class TourModal {
  constructor() {
    this.currentStep = 0;
    this.modalEl = null;
    this.role = null;
    this.steps = [];
  }

  start(role) {
    this.role = role || store.getState().role || 'Officer';
    this.steps = ROLE_TOURS[this.role] || ROLE_TOURS['Officer'];
    this.currentStep = 0;
    this.render();
  }

  render() {
    if (this.modalEl) this.modalEl.remove();

    const step = this.steps[this.currentStep];
    const total = this.steps.length;
    const isFirst = this.currentStep === 0;
    const isLast = this.currentStep === total - 1;

    const overlay = document.createElement('div');
    overlay.className = 'modal-backdrop';
    overlay.style.cssText = 'position: fixed; inset: 0; background: rgba(15, 23, 42, 0.7); backdrop-filter: blur(4px); z-index: 9999; display: flex; align-items: center; justify-content: center; padding: 20px;';

    overlay.innerHTML = `
      <div class="card" style="max-width: 500px; width: 100%; border-radius: var(--radius-lg); padding: 32px; box-shadow: var(--shadow-xl); position: relative; border: 1px solid var(--border-color); background: var(--bg-surface);">
        <!-- Step progress dots -->
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;">
          <span class="badge" style="background: rgba(20, 48, 122, 0.08); color: var(--primary); font-weight: 700;">
            Step ${this.currentStep + 1} of ${total}
          </span>
          <div style="display: flex; gap: 6px;">
            ${this.steps.map((_, i) => `
              <div style="width: 8px; height: 8px; border-radius: 50%; background: ${i === this.currentStep ? 'var(--primary)' : 'var(--border-color)'};"></div>
            `).join('')}
          </div>
        </div>

        <!-- Step content -->
        <div style="text-align: center; margin-bottom: 24px;">
          <div style="width: 64px; height: 64px; border-radius: 16px; background: rgba(20, 48, 122, 0.08); display: flex; align-items: center; justify-content: center; margin: 0 auto 16px auto; color: var(--primary);">
            <svg class="icon" style="width: 32px; height: 32px;"><use href="vendor/lucide-sprite.svg#${step.icon}"></use></svg>
          </div>
          <h2 style="font-size: 20px; font-weight: 700; margin: 0 0 10px 0; color: var(--text-color);">
            ${step.title}
          </h2>
          <p style="font-size: 14px; color: var(--text-muted); line-height: 1.6; margin: 0;">
            ${step.description}
          </p>
        </div>

        <!-- Buttons -->
        <div style="display: flex; justify-content: space-between; align-items: center; pt: 16px; border-top: 1px solid var(--border-color);">
          <button class="btn btn-ghost btn-sm btn-tour-skip">
            Skip Tour
          </button>
          <div style="display: flex; gap: 10px;">
            ${!isFirst ? `
              <button class="btn btn-secondary btn-sm btn-tour-prev">
                Back
              </button>
            ` : ''}
            <button class="btn btn-primary btn-sm btn-tour-next">
              ${isLast ? 'Get Started' : 'Next Step'}
            </button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    this.modalEl = overlay;

    // Attach button listeners
    overlay.querySelector('.btn-tour-skip').addEventListener('click', () => this.close());
    const prevBtn = overlay.querySelector('.btn-tour-prev');
    if (prevBtn) {
      prevBtn.addEventListener('click', () => {
        if (this.currentStep > 0) {
          this.currentStep--;
          this.render();
        }
      });
    }
    overlay.querySelector('.btn-tour-next').addEventListener('click', () => {
      if (isLast) {
        this.close();
      } else {
        this.currentStep++;
        this.render();
      }
    });
  }

  close() {
    if (this.modalEl) {
      this.modalEl.remove();
      this.modalEl = null;
    }
    try {
      localStorage.setItem(`apaar_tour_completed_${this.role}`, 'true');
    } catch {
      // localStorage may fail in restricted mode
    }
  }
}

export const tourModal = new TourModal();

// Global listener for tour trigger
window.addEventListener('apaar:start-tour', () => {
  tourModal.start();
});
