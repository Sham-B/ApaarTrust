/**
 * College Registrar Overview Page
 * Onboarding checklist with progress, animated seat gauges, submission countdown, open to-dos
 */

import { api } from '../api.js';
import { renderAppShell, bindAppShellEvents } from '../ui/AppShell.js';
import { renderSeatGauge } from '../ui/Gauge.js';
import { statusPill } from '../ui/StatusPill.js';
import { iconHtml } from '../ui/icons.js';

export async function renderCollegeOverview(container) {
  let instDetail = null;
  let students = [];

  try {
    [instDetail, students] = await Promise.all([
      api.get('/api/v1/institutions/1-1090123456'),
      api.get('/api/v1/institutions/1-1090123456/students'),
    ]);
  } catch (err) {
    console.error('Failed to load college overview:', err);
  }

  const inst = instDetail?.institution || {
    name: 'Aryabhata Institute of Technology',
    aicte_pid: '1-1090123456',
  };
  const matrices = instDetail?.seat_matrices || [];
  const findings = instDetail?.findings || [];

  const contentHtml = `
    <!-- Page Header -->
    <div class="page-header">
      <div class="page-header-text">
        <div style="font-size: 0.85rem; color: var(--saffron); font-weight: 600; margin-bottom: 2px;">
          Aryabhata Institute of Technology · AICTE PID: ${inst.aicte_pid}
        </div>
        <h1>College Registrar Workspace</h1>
        <p>Annual intake submission, seat matrix compliance, student certificate issuance, and regulatory to-dos.</p>
      </div>

      <div class="page-actions">
        <a href="#/college/upload" class="btn btn-primary btn-sm">
          ${iconHtml('upload-cloud', 'icon-sm')} Upload intake batch
        </a>
      </div>
    </div>

    <!-- Onboarding & Progress Banner -->
    <div class="card" style="margin-bottom: var(--space-6); background: linear-gradient(135deg, rgba(232, 115, 26, 0.05) 0%, rgba(20, 48, 122, 0.05) 100%);">
      <div class="card-body">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
          <h3 style="font-size: 1.05rem; margin: 0; color: var(--navy); display: flex; align-items: center; gap: 8px;">
            ${iconHtml('check-square', 'icon-sm')} Academic Year 2024-25 Reporting Progress
          </h3>
          <span class="status-pill status-good">3 of 4 Completed</span>
        </div>
        <p style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: var(--space-3);">
          Ensure all student enrolments are uploaded and validated before the central portal cutoff.
        </p>

        <!-- Progress Bar -->
        <div style="height: 8px; background: var(--border-subtle); border-radius: 4px; overflow: hidden; margin-bottom: 12px;">
          <div style="width: 75%; height: 100%; background: linear-gradient(90deg, var(--saffron), var(--navy)); border-radius: 4px;"></div>
        </div>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; font-size: 0.82rem;">
          <div style="display: flex; align-items: center; gap: 6px;"><span style="color: var(--green);">✓</span> Intake template downloaded</div>
          <div style="display: flex; align-items: center; gap: 6px;"><span style="color: var(--green);">✓</span> Dry-run spreadsheet pre-checked</div>
          <div style="display: flex; align-items: center; gap: 6px;"><span style="color: var(--green);">✓</span> Initial roster batch v1 committed</div>
          <div style="display: flex; align-items: center; gap: 6px;"><span style="color: var(--saffron);">⏳</span> Final committee verification pending</div>
        </div>
      </div>
    </div>

    <!-- Split Grid: Seat Matrix Gauges vs Countdown & Todos -->
    <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 24px; margin-bottom: var(--space-6);" class="college-split-grid">
      <!-- Seat Matrix Gauges -->
      <div class="card">
        <div class="card-header">
          <div>
            <h3>Programme Seat Matrix Utilization</h3>
            <small>DEMO VALUES, not AICTE rules; configure from the Approval Process Handbook</small>
          </div>
          <span class="status-pill status-good">Within Ceiling</span>
        </div>
        <div class="card-body" style="display: flex; flex-direction: column; gap: var(--space-4);">
          ${matrices
            .map((m) => {
              const count = students.filter((s) => s.programme === m.programme).length;
              return renderSeatGauge({
                programme: m.programme,
                approved: m.approved_intake,
                admitted: count,
                quota: 'Regular',
              });
            })
            .join('')}
        </div>
      </div>

      <!-- Submission Deadline Countdown & To-Dos -->
      <div style="display: flex; flex-direction: column; gap: var(--space-4);">
        <!-- Countdown Widget -->
        <div class="card" style="border-top: 4px solid var(--saffron);">
          <div class="card-body">
            <small style="color: var(--text-muted); font-weight: 500;">Submission Cutoff Deadline</small>
            <div style="font-size: 1.85rem; font-weight: 800; color: var(--navy); margin: 4px 0;" class="tabular">
              18 Days Left
            </div>
            <p style="font-size: 0.8rem; color: var(--text-muted);">
              AY 2024-25 intake window closes on November 15, 2024 at 23:59 IST.
            </p>
          </div>
        </div>

        <!-- Open To-Dos Card -->
        <div class="card" style="flex: 1;">
          <div class="card-header">
            <h3>Action Items & To-dos</h3>
            <span class="status-pill status-waiting">2 Pending</span>
          </div>
          <div class="card-body" style="font-size: 0.85rem; display: flex; flex-direction: column; gap: 12px;">
            <div style="display: flex; gap: 8px; align-items: flex-start;">
              <input type="checkbox" style="margin-top: 3px;" />
              <div>
                <strong>Verify TFW Income Proofs</strong>
                <p style="font-size: 0.78rem; color: var(--text-muted);">4 students admitted under Tuition Fee Waiver require attested state income certificates.</p>
              </div>
            </div>
            <div style="display: flex; gap: 8px; align-items: flex-start;">
              <input type="checkbox" style="margin-top: 3px;" />
              <div>
                <strong>Issue First-Semester Credentials</strong>
                <p style="font-size: 0.78rem; color: var(--text-muted);">Issue signed digital enrolment certificates via the Certificate Studio.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  const breadcrumbs = [{ label: 'Overview', href: '#/college/overview' }];
  container.innerHTML = renderAppShell(contentHtml, breadcrumbs);
  bindAppShellEvents();
}
