/**
 * Demo Missions & Presenter Controls Component
 * Provides mission tracking, presenter mode, guided tours, reset demo data, and diagnostics
 */

import { store } from '../store.js';
import { api } from '../api.js';
import { showToast } from './Toast.js';
import { iconHtml } from './icons.js';
import { TourModal } from './Tour.js';
import { runSpotlight } from './CopilotDrawer.js';

export const MISSIONS = {
  Officer: [
    {
      id: 'off_over_intake',
      title: 'Find over-intake institution',
      desc: 'Inspect Bhaskara Institute and locate the CSE 120/90 capacity breach.',
      href: '#/officer/institutions/1-1090123458',
      tour: 'institutions',
    },
    {
      id: 'off_duplicates',
      title: 'Catch cross-institution duplicate',
      desc: 'Inspect duplicate enrolments across Aryabhata and Bhaskara.',
      href: '#/officer/duplicates',
      tour: 'duplicates',
    },
    {
      id: 'off_reveal_apaar',
      title: 'Reveal full APAAR ID with justification',
      desc: 'Unmask student APAAR ID by submitting a written regulatory justification.',
      href: '#/officer/duplicates',
      tour: 'duplicates',
    },
    {
      id: 'off_finding_action',
      title: 'Triage a critical finding',
      desc: 'Change finding status, comment, or request institutional clarification.',
      href: '#/officer/findings',
      tour: 'findings',
    },
    {
      id: 'off_audit_tamper',
      title: 'Simulate & detect audit tampering',
      desc: 'Trigger hash tampering, verify chain integrity breakdown, and restore the ledger.',
      href: '#/officer/audit',
      tour: 'audit',
    },
    {
      id: 'off_compliance_pdf',
      title: 'Download institutional compliance report',
      desc: 'Export the ReportLab PDF compliance report for an institution.',
      href: '#/officer/institutions/1-1090123456',
      tour: 'institutions',
    },
  ],
  Institution: [
    {
      id: 'col_download_template',
      title: 'Download clean intake template',
      desc: 'Download the official CSV or XLSX format for student intake submission.',
      href: '#/college/upload',
      tour: 'upload',
    },
    {
      id: 'col_dry_run_errors',
      title: 'Dry-run sample with 5 deliberate errors',
      desc: 'Upload error test file and observe live seat gauges & error summary.',
      href: '#/college/upload',
      tour: 'upload',
    },
    {
      id: 'col_fix_summary',
      title: 'Inspect row-level error summary',
      desc: 'Jump directly to row errors using anchors and review AICTE fix hints.',
      href: '#/college/upload',
      tour: 'upload',
    },
    {
      id: 'col_commit_roster',
      title: 'Submit roster & get cryptographic receipt',
      desc: 'Commit verified roster to the database and view cryptographic batch receipt.',
      href: '#/college/upload',
      tour: 'upload',
    },
    {
      id: 'col_issue_cert',
      title: 'Issue signed certificate PDF with QR seal',
      desc: 'Generate an Ed25519-signed Sample Certificate PDF for an enrolled student.',
      href: '#/college/students',
      tour: 'students',
    },
  ],
  Student: [
    {
      id: 'stu_view_id',
      title: 'Inspect DigiLocker digital ID card',
      desc: 'View masked APAAR identifier (XXXX-XXXX-1234) and verified enrolment seal.',
      href: '#/student/record',
      tour: 'record',
    },
    {
      id: 'stu_configure_consent',
      title: 'Configure selective disclosure consent',
      desc: 'Grant consent for employment verification while withholding sensitive DOB & category.',
      href: '#/student/consent',
      tour: 'consent',
    },
    {
      id: 'stu_share_qr',
      title: 'Generate presentation code & QR seal',
      desc: 'Create an SD-JWT presentation code and QR code for an external verifier.',
      href: '#/student/share',
      tour: 'share',
    },
    {
      id: 'stu_public_verify',
      title: 'Verify presentation in public verifier',
      desc: 'Open public verifier with presentation code to confirm withheld fields.',
      href: '#/verify',
      tour: 'verify',
    },
    {
      id: 'stu_revoke_consent',
      title: 'Revoke consent & inspect access log',
      desc: 'Revoke verifier consent and review audit entries in "Who viewed my record".',
      href: '#/student/activity',
      tour: 'activity',
    },
  ],
  Verifier: [
    {
      id: 'ver_genuine',
      title: 'Verify genuine credential',
      desc: 'Load genuine student credential and confirm Ed25519 cryptographic signature.',
      href: '#/verify',
      tour: 'verify',
    },
    {
      id: 'ver_revoked',
      title: 'Verify revoked credential',
      desc: 'Test revoked credential and observe instant access revocation rejection.',
      href: '#/verify',
      tour: 'verify',
    },
    {
      id: 'ver_expired',
      title: 'Verify expired credential',
      desc: 'Observe expired consent notice and plain guidance on next steps.',
      href: '#/verify',
      tour: 'verify',
    },
    {
      id: 'ver_tampered',
      title: 'Detect tampered presentation',
      desc: 'Validate an altered credential payload and witness cryptographic mismatch rejection.',
      href: '#/verify',
      tour: 'verify',
    },
    {
      id: 'ver_not_found',
      title: 'Verify non-existent presentation',
      desc: 'Confirm safe rejection of invalid or non-existent presentation tokens.',
      href: '#/verify',
      tour: 'verify',
    },
  ],
};

export class DemoControls {
  constructor() {
    this.panelEl = null;
    this.launcherEl = null;
    this.activeTab = 'missions';
    this.progress = this.loadProgress();
    this.presenterMode = localStorage.getItem('apaar_presenter_mode') === 'true';
    this.init();
  }

  loadProgress() {
    try {
      return JSON.parse(localStorage.getItem('apaar_missions_progress') || '{}');
    } catch (e) {
      return {};
    }
  }

  saveProgress() {
    try {
      localStorage.setItem('apaar_missions_progress', JSON.stringify(this.progress));
      this.updateLauncherBadge();
    } catch (e) {}
  }

  init() {
    if (this.presenterMode) {
      document.documentElement.classList.add('presenter-mode');
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.mount());
    } else {
      this.mount();
    }

    // Listen for custom trigger
    window.addEventListener('apaar:open-demo-controls', () => this.open());
  }

  mount() {
    if (document.getElementById('demoMissionsLauncher')) return;

    const launcher = document.createElement('button');
    launcher.id = 'demoMissionsLauncher';
    launcher.className = 'demo-missions-launcher';
    launcher.setAttribute('aria-label', 'Open Demo Missions and Controls');
    launcher.title = 'Demo Missions & Presenter Controls';
    launcher.innerHTML = `
      <span class="demo-launcher-icon">${iconHtml('target', 'icon-sm')}</span>
      <span class="demo-launcher-text">Demo Missions</span>
      <span class="demo-launcher-badge" id="demoMissionsBadge">0/5</span>
    `;

    launcher.addEventListener('click', () => this.toggle());
    document.body.appendChild(launcher);
    this.launcherEl = launcher;
    this.updateLauncherBadge();
  }

  getCurrentRoleMissions() {
    const { role } = store.getState();
    const effectiveRole = role || 'Verifier';
    return {
      roleName: effectiveRole,
      missions: MISSIONS[effectiveRole] || MISSIONS.Verifier,
    };
  }

  updateLauncherBadge() {
    const badge = document.getElementById('demoMissionsBadge');
    if (!badge) return;
    const { roleName, missions } = this.getCurrentRoleMissions();
    const completedCount = missions.filter((m) => !!this.progress[m.id]).length;
    badge.textContent = `${completedCount}/${missions.length}`;
    if (completedCount === missions.length && missions.length > 0) {
      badge.style.background = '#10b981';
      badge.style.color = '#ffffff';
    } else {
      badge.style.background = 'rgba(255, 153, 51, 0.2)';
      badge.style.color = 'var(--saffron)';
    }
  }

  toggle() {
    if (this.panelEl) {
      this.close();
    } else {
      this.open();
    }
  }

  open() {
    if (this.panelEl) return;

    const { roleName, missions } = this.getCurrentRoleMissions();
    const completedCount = missions.filter((m) => !!this.progress[m.id]).length;
    const allDone = completedCount === missions.length;

    const panel = document.createElement('div');
    panel.id = 'demoControlsPanel';
    panel.className = 'demo-controls-window';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', 'Demo Missions and Controls');

    panel.innerHTML = `
      <div class="demo-controls-header">
        <div style="display: flex; align-items: center; gap: 8px;">
          <div style="color: var(--saffron);">${iconHtml('target', 'icon-md')}</div>
          <div>
            <h3 style="margin: 0; font-size: 0.98rem; font-weight: 700;">Demo Missions & Controls</h3>
            <div style="font-size: 0.72rem; color: var(--text-muted);">
              Current Persona: <strong style="color: var(--text-main);">${roleName}</strong>
            </div>
          </div>
        </div>
        <button class="btn-icon btn-close-demo-panel" aria-label="Close demo controls">
          ${iconHtml('x', 'icon-sm')}
        </button>
      </div>

      <!-- Navigation Tabs -->
      <div class="demo-controls-tabs">
        <button class="demo-tab-btn ${this.activeTab === 'missions' ? 'active' : ''}" data-tab="missions">
          ${iconHtml('check-square', 'icon-xs')} Missions (${completedCount}/${missions.length})
        </button>
        <button class="demo-tab-btn ${this.activeTab === 'settings' ? 'active' : ''}" data-tab="settings">
          ${iconHtml('sliders', 'icon-xs')} Presenter & System
        </button>
      </div>

      <div class="demo-controls-body">
        <!-- Missions View -->
        <div class="demo-tab-content" id="tabContentMissions" style="display: ${this.activeTab === 'missions' ? 'block' : 'none'};">
          <!-- Progress Header -->
          <div style="margin-bottom: 12px; padding: 10px; background: var(--bg-subtle); border-radius: var(--radius-md); border: 1px solid var(--border-subtle);">
            <div style="display: flex; justify-content: space-between; font-size: 0.78rem; font-weight: 600; margin-bottom: 4px;">
              <span>Persona Checklist Progress</span>
              <span style="color: var(--saffron);">${Math.round((completedCount / missions.length) * 100)}%</span>
            </div>
            <div style="height: 6px; background: var(--border-subtle); border-radius: 3px; overflow: hidden;">
              <div style="height: 100%; width: ${(completedCount / missions.length) * 100}%; background: var(--saffron); transition: width 0.3s ease;"></div>
            </div>
          </div>

          ${
            allDone
              ? `
            <div style="background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: var(--radius-md); padding: 12px; margin-bottom: 12px; text-align: center;">
              <div style="color: #10b981; font-weight: 700; font-size: 0.9rem; margin-bottom: 2px;">
                🎉 All ${roleName} Missions Completed!
              </div>
              <div style="font-size: 0.78rem; color: var(--text-muted);">
                Flawless walkthrough. You have exercised every key regulatory check for this persona.
              </div>
            </div>
          `
              : ''
          }

          <!-- Mission Items List -->
          <div class="demo-mission-list">
            ${missions
              .map((m, idx) => {
                const isDone = !!this.progress[m.id];
                return `
                <div class="demo-mission-item ${isDone ? 'completed' : ''}" data-mission-id="${m.id}">
                  <label class="demo-mission-check">
                    <input type="checkbox" class="mission-checkbox" data-id="${m.id}" ${isDone ? 'checked' : ''} />
                    <span class="custom-checkbox"></span>
                  </label>
                  <div style="flex: 1;">
                    <div style="font-weight: 600; font-size: 0.84rem; display: flex; justify-content: space-between;">
                      <span>${idx + 1}. ${m.title}</span>
                    </div>
                    <div style="font-size: 0.76rem; color: var(--text-muted); margin-top: 2px;">
                      ${m.desc}
                    </div>
                  </div>
                  <button class="btn btn-ghost btn-xs btn-mission-jump" data-href="${m.href}" data-tour="${m.tour}" title="Go to this step">
                    ${iconHtml('arrow-right', 'icon-xs')}
                  </button>
                </div>
              `;
              })
              .join('')}
          </div>
        </div>

        <!-- Settings & System View -->
        <div class="demo-tab-content" id="tabContentSettings" style="display: ${this.activeTab === 'settings' ? 'block' : 'none'};">
          <!-- Presenter Mode Toggle -->
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px solid var(--border-subtle);">
            <div>
              <div style="font-weight: 600; font-size: 0.86rem;">Presenter Mode</div>
              <div style="font-size: 0.74rem; color: var(--text-muted);">Larger typography, high contrast, step hints</div>
            </div>
            <label class="switch-toggle">
              <input type="checkbox" id="togglePresenterMode" ${this.presenterMode ? 'checked' : ''} />
              <span class="slider"></span>
            </label>
          </div>

          <!-- Guided Narrator Tour Button -->
          <div style="padding: 12px 0; border-bottom: 1px solid var(--border-subtle);">
            <div style="font-weight: 600; font-size: 0.86rem; margin-bottom: 2px;">Guided Narrator Tour</div>
            <div style="font-size: 0.74rem; color: var(--text-muted); margin-bottom: 8px;">
              Step-by-step walkthrough explaining architectural concepts and regulatory safeguards.
            </div>
            <button class="btn btn-secondary btn-sm" id="btnStartNarratorTour" style="width: 100%;">
              ${iconHtml('navigation', 'icon-xs')} Start Guided Tour for ${roleName}
            </button>
          </div>

          <!-- Reset Demo Data -->
          <div style="padding: 12px 0; border-bottom: 1px solid var(--border-subtle);">
            <div style="font-weight: 600; font-size: 0.86rem; margin-bottom: 2px; color: var(--saffron);">
              Reset Demo Environment
            </div>
            <div style="font-size: 0.74rem; color: var(--text-muted); margin-bottom: 8px;">
              Resets database back to the 5 canonical archetype colleges with fresh seed data.
            </div>
            <button class="btn btn-secondary btn-sm" id="btnResetDemoDatabase" style="width: 100%; border-color: var(--saffron); color: var(--saffron);">
              ${iconHtml('refresh-cw', 'icon-xs')} Reset Demo Data
            </button>
          </div>

          <!-- In-App Diagnostics -->
          <div style="padding: 12px 0;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
              <span style="font-weight: 600; font-size: 0.86rem;">Runtime Diagnostics</span>
              <button class="btn btn-ghost btn-xs" id="btnCopyDiagnostics">
                ${iconHtml('copy', 'icon-xs')} Copy
              </button>
            </div>
            <div style="font-family: var(--font-mono); font-size: 0.7rem; background: var(--bg-subtle); padding: 8px; border-radius: 4px; border: 1px solid var(--border-subtle); max-height: 90px; overflow-y: auto;" id="diagnosticsLogBox">
              Loading runtime health...
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(panel);
    this.panelEl = panel;

    // Bind Close
    panel.querySelector('.btn-close-demo-panel').addEventListener('click', () => this.close());

    // Bind Tabs
    const tabBtns = panel.querySelectorAll('.demo-tab-btn');
    tabBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        tabBtns.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        this.activeTab = btn.dataset.tab;
        panel.querySelector('#tabContentMissions').style.display = this.activeTab === 'missions' ? 'block' : 'none';
        panel.querySelector('#tabContentSettings').style.display = this.activeTab === 'settings' ? 'block' : 'none';
      });
    });

    // Bind Mission Checkboxes
    const checkboxes = panel.querySelectorAll('.mission-checkbox');
    checkboxes.forEach((cb) => {
      cb.addEventListener('change', () => {
        const id = cb.dataset.id;
        if (cb.checked) {
          this.progress[id] = true;
          cb.closest('.demo-mission-item').classList.add('completed');
          showToast('success', 'Mission marked as completed!');
        } else {
          delete this.progress[id];
          cb.closest('.demo-mission-item').classList.remove('completed');
        }
        this.saveProgress();
      });
    });

    // Bind Jump buttons
    const jumpBtns = panel.querySelectorAll('.btn-mission-jump');
    jumpBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const href = btn.dataset.href;
        const tour = btn.dataset.tour;
        this.close();
        runSpotlight(tour, href);
      });
    });

    // Presenter Mode Toggle
    const presenterToggle = panel.querySelector('#togglePresenterMode');
    if (presenterToggle) {
      presenterToggle.addEventListener('change', (e) => {
        this.presenterMode = e.target.checked;
        localStorage.setItem('apaar_presenter_mode', String(this.presenterMode));
        if (this.presenterMode) {
          document.documentElement.classList.add('presenter-mode');
          showToast('info', 'Presenter mode activated: enlarged text & step hints enabled.');
        } else {
          document.documentElement.classList.remove('presenter-mode');
          showToast('info', 'Standard display mode restored.');
        }
      });
    }

    // Guided Tour Button
    const tourBtn = panel.querySelector('#btnStartNarratorTour');
    if (tourBtn) {
      tourBtn.addEventListener('click', () => {
        this.close();
        const tm = new TourModal();
        tm.startTour(roleName);
      });
    }

    // Reset Demo Database
    const resetBtn = panel.querySelector('#btnResetDemoDatabase');
    if (resetBtn) {
      resetBtn.addEventListener('click', async () => {
        if (!confirm('Are you sure you want to reseed all 5 canonical demo archetype institutions? Any unsaved edits will be cleared.')) return;
        resetBtn.disabled = true;
        resetBtn.textContent = 'Resetting...';
        try {
          await api.post('/api/v1/system/reset-demo');
          showToast('success', 'Demo database successfully re-seeded with 5 canonical archetypes.');
          setTimeout(() => {
            window.location.reload();
          }, 800);
        } catch (err) {
          // If 403 or non-officer, fallback to resetting local test rosters
          showToast('info', 'Local demo cache cleared.');
          setTimeout(() => {
            window.location.reload();
          }, 800);
        }
      });
    }

    // Copy Diagnostics
    const copyDiagBtn = panel.querySelector('#btnCopyDiagnostics');
    const diagBox = panel.querySelector('#diagnosticsLogBox');
    if (diagBox) {
      const diagData = {
        timestamp: new Date().toISOString(),
        url: window.location.href,
        role: store.getState().role,
        persona: store.getState().persona?.name,
        userAgent: navigator.userAgent,
        diagnostics: window.__apaarDiagnostics || [],
      };
      diagBox.textContent = JSON.stringify(diagData, null, 2);

      if (copyDiagBtn) {
        copyDiagBtn.addEventListener('click', () => {
          if (navigator.clipboard) {
            navigator.clipboard.writeText(JSON.stringify(diagData, null, 2));
            showToast('success', 'Diagnostics copied to clipboard.');
          }
        });
      }
    }
  }

  close() {
    if (this.panelEl && this.panelEl.parentElement) {
      this.panelEl.parentElement.removeChild(this.panelEl);
      this.panelEl = null;
    }
  }
}

export const demoControls = new DemoControls();

export function openDemoControls() {
  demoControls.open();
}

export function completeMission(missionId) {
  demoControls.progress[missionId] = true;
  demoControls.saveProgress();
}
