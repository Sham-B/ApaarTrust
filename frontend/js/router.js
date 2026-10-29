/**
 * Hash Router with Client Route Guards and Lazy Page Loading
 */

import { store } from './store.js';
import { auth } from './auth.js';

class Router {
  constructor() {
    this.routes = new Map();
    this.currentHash = '';
    this.init();
  }

  init() {
    window.addEventListener('hashchange', () => this.handleRoute());
    window.addEventListener('DOMContentLoaded', () => this.handleRoute());
  }

  register(path, loader) {
    this.routes.set(path, loader);
  }

  async handleRoute() {
    let hash = window.location.hash || '#/';
    if (!hash.startsWith('#/')) {
      hash = '#/';
      window.location.hash = hash;
      return;
    }

    this.currentHash = hash;
    const cleanPath = hash.replace(/^#\/?/, '').split('?')[0];

    // Check client route guard
    if (!auth.canAccessRoute(hash)) {
      const { role } = store.getState();
      const targetHome = auth.getRoleHome(role);

      window.dispatchEvent(
        new CustomEvent('apaar:toast', {
          detail: {
            type: 'warning',
            message: role ? `Access restricted: your current role (${role}) cannot access this portal.` : 'Please select a role to access this portal.',
          },
        })
      );

      window.location.hash = targetHome;
      return;
    }

    // Match route handler
    const appRoot = document.getElementById('app');
    if (!appRoot) return;

    try {
      if (!cleanPath || cleanPath === '') {
        // Landing page
        const { renderLandingPage } = await import('./pages/LandingPage.js');
        await renderLandingPage(appRoot);
      } else if (cleanPath.startsWith('officer/')) {
        const sub = cleanPath.replace('officer/', '');
        if (sub === 'overview' || sub === '') {
          const { renderOfficerOverview } = await import('./pages/OfficerOverviewPage.js');
          await renderOfficerOverview(appRoot);
        } else if (sub === 'institutions') {
          const { renderOfficerInstitutions } = await import('./pages/OfficerInstitutionsPage.js');
          await renderOfficerInstitutions(appRoot);
        } else if (sub.startsWith('institutions/')) {
          const instId = sub.replace('institutions/', '');
          const { renderOfficerInstitutionDetail } = await import('./pages/OfficerInstitutionDetailPage.js');
          await renderOfficerInstitutionDetail(appRoot, instId);
        } else if (sub === 'findings') {
          const { renderOfficerFindings } = await import('./pages/OfficerFindingsPage.js');
          await renderOfficerFindings(appRoot);
        } else if (sub === 'duplicates') {
          const { renderOfficerDuplicates } = await import('./pages/OfficerDuplicatesPage.js');
          await renderOfficerDuplicates(appRoot);
        } else if (sub === 'verifications') {
          const { renderOfficerVerifications } = await import('./pages/OfficerVerificationsPage.js');
          await renderOfficerVerifications(appRoot);
        } else if (sub === 'insights') {
          const { renderOfficerInsights } = await import('./pages/OfficerInsightsPage.js');
          await renderOfficerInsights(appRoot);
        } else if (sub === 'audit') {
          const { renderOfficerAudit } = await import('./pages/OfficerAuditPage.js');
          await renderOfficerAudit(appRoot);
        } else if (sub === 'rules') {
          const { renderOfficerRules } = await import('./pages/OfficerRulesPage.js');
          await renderOfficerRules(appRoot);
        } else {
          this.render404(appRoot);
        }
      } else if (cleanPath.startsWith('college/')) {
        const sub = cleanPath.replace('college/', '');
        if (sub === 'overview' || sub === '') {
          const { renderCollegeOverview } = await import('./pages/CollegeOverviewPage.js');
          await renderCollegeOverview(appRoot);
        } else if (sub === 'upload') {
          const { renderCollegeUpload } = await import('./pages/CollegeUploadPage.js');
          await renderCollegeUpload(appRoot);
        } else if (sub === 'students') {
          const { renderCollegeStudents } = await import('./pages/CollegeStudentsPage.js');
          await renderCollegeStudents(appRoot);
        } else if (sub === 'certificates') {
          const { renderCollegeCertificates } = await import('./pages/CollegeCertificatesPage.js');
          await renderCollegeCertificates(appRoot);
        } else if (sub === 'submissions') {
          const { renderCollegeSubmissions } = await import('./pages/CollegeSubmissionsPage.js');
          await renderCollegeSubmissions(appRoot);
        } else if (sub === 'todos') {
          const { renderCollegeTodos } = await import('./pages/CollegeTodosPage.js');
          await renderCollegeTodos(appRoot);
        } else {
          this.render404(appRoot);
        }
      } else if (cleanPath.startsWith('student/')) {
        const sub = cleanPath.replace('student/', '');
        if (sub === 'record' || sub === '') {
          const { renderStudentRecord } = await import('./pages/StudentRecordPage.js');
          await renderStudentRecord(appRoot);
        } else if (sub === 'consent') {
          const { renderStudentConsent } = await import('./pages/StudentConsentPage.js');
          await renderStudentConsent(appRoot);
        } else if (sub === 'activity') {
          const { renderStudentActivity } = await import('./pages/StudentActivityPage.js');
          await renderStudentActivity(appRoot);
        } else if (sub === 'certificates') {
          const { renderStudentCertificates } = await import('./pages/StudentCertificatesPage.js');
          await renderStudentCertificates(appRoot);
        } else if (sub === 'share') {
          const { renderStudentShare } = await import('./pages/StudentSharePage.js');
          await renderStudentShare(appRoot);
        } else {
          this.render404(appRoot);
        }
      } else if (cleanPath === 'verify' || cleanPath.startsWith('verify/')) {
        const { renderPublicVerify } = await import('./pages/PublicVerifyPage.js');
        await renderPublicVerify(appRoot);
      } else if (cleanPath === 'assistant') {
        const { renderAssistantPage } = await import('./pages/AssistantPage.js');
        await renderAssistantPage(appRoot);
      } else if (cleanPath === 'help' || cleanPath.startsWith('help/')) {
        const { renderHelpCenter } = await import('./pages/HelpCenterPage.js');
        await renderHelpCenter(appRoot);
      } else {
        this.render404(appRoot);
      }
    } catch (err) {
      console.error('Page render error:', err);
      const role = store.getState().role || 'Unauthenticated';
      const diagEntry = {
        timestamp: new Date().toISOString(),
        route: hash,
        role,
        error: err.message,
        stack: err.stack,
        userAgent: navigator.userAgent
      };

      window.__apaarDiagnostics = window.__apaarDiagnostics || [];
      window.__apaarDiagnostics.unshift(diagEntry);

      appRoot.innerHTML = `
        <div style="max-width: 600px; margin: 60px auto; padding: 24px;">
          <div class="card" style="border-left: 4px solid var(--danger); padding: 32px; box-shadow: var(--shadow-lg);">
            <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px;">
              <div style="width: 40px; height: 40px; border-radius: 10px; background: rgba(198, 40, 40, 0.1); display: flex; align-items: center; justify-content: center; color: var(--danger);">
                <svg class="icon" style="width: 22px; height: 22px;"><use href="vendor/lucide-sprite.svg#alert-triangle"></use></svg>
              </div>
              <div>
                <h3 style="margin: 0; font-size: 18px; color: var(--text-color);">
                  ${err.message && (err.message.includes('fetch') || err.message.includes('network') || err.message.includes('Failed to fetch'))
                    ? 'Backend Server Offline / Unreachable'
                    : 'Something went wrong loading this view'}
                </h3>
                <div style="font-size: 12px; color: var(--text-muted); margin-top: 2px;">Route: <code style="font-family: monospace;">${hash}</code> &bull; Role: <strong>${role}</strong></div>
              </div>
            </div>

            <div style="background: var(--bg-surface-elevated); border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 14px; font-family: monospace; font-size: 12px; color: var(--danger); margin-bottom: 24px; max-height: 140px; overflow-y: auto; white-space: pre-wrap;">
${err.message && (err.message.includes('fetch') || err.message.includes('network') || err.message.includes('Failed to fetch'))
  ? 'The frontend could not connect to the Python backend API. Please make sure the local server is running (python run.py) and reachable.'
  : (err.message || 'Unknown view render error')}
            </div>

            <div style="display: flex; gap: 12px; flex-wrap: wrap;">
              <button class="btn btn-primary btn-sm" id="btn-err-retry">
                <svg class="icon"><use href="vendor/lucide-sprite.svg#rotate-cw"></use></svg>
                Retry View
              </button>
              <button class="btn btn-secondary btn-sm" id="btn-err-report">
                <svg class="icon"><use href="vendor/lucide-sprite.svg#copy"></use></svg>
                Copy Diagnostics
              </button>
              <a href="#/" class="btn btn-ghost btn-sm">
                <svg class="icon"><use href="vendor/lucide-sprite.svg#home"></use></svg>
                Back to Home
              </a>
            </div>
          </div>
        </div>
      `;

      const retryBtn = appRoot.querySelector('#btn-err-retry');
      if (retryBtn) {
        retryBtn.addEventListener('click', () => this.handleRoute());
      }

      const reportBtn = appRoot.querySelector('#btn-err-report');
      if (reportBtn) {
        reportBtn.addEventListener('click', () => {
          navigator.clipboard.writeText(JSON.stringify(diagEntry, null, 2)).then(() => {
            reportBtn.innerHTML = `<svg class="icon"><use href="vendor/lucide-sprite.svg#check"></use></svg> Diagnostics Copied!`;
            setTimeout(() => {
              reportBtn.innerHTML = `<svg class="icon"><use href="vendor/lucide-sprite.svg#copy"></use></svg> Copy Diagnostics`;
            }, 3000);
          });
        });
      }
    }
  }

  render404(appRoot) {
    import('./ui/EmptyState.js').then(({ renderEmptyState }) => {
      appRoot.innerHTML = `
        <div style="padding: 60px 20px;">
          ${renderEmptyState({
            iconName: 'alert-triangle',
            title: 'Page not found',
            description: 'The requested route does not exist or has been moved.',
            actionHtml: '<a href="#/" class="btn btn-primary">Return to home</a>',
          })}
        </div>
      `;
    });
  }
}

export const router = new Router();
