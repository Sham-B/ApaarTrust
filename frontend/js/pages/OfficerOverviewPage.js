/**
 * Officer Overview Page
 * Greeting, KPI Sparkline Cards, India State Tile Map, Intake Chart, Attention Queue, Recent Feed
 */

import { api } from '../api.js';
import { renderAppShell, bindAppShellEvents } from '../ui/AppShell.js';
import { renderStatCard } from '../ui/StatCard.js';
import { statusPill } from '../ui/StatusPill.js';
import { iconHtml } from '../ui/icons.js';

export async function renderOfficerOverview(container) {
  // Fetch required data in parallel
  let sparklines = null;
  let stateMap = null;
  let institutions = [];

  try {
    [sparklines, stateMap, institutions] = await Promise.all([
      api.get('/api/v1/officer/sparklines'),
      api.get('/api/v1/officer/state-map'),
      api.get('/api/v1/institutions'),
    ]);
  } catch (err) {
    console.error('Failed to load officer overview data:', err);
  }

  const kpis = sparklines || {
    institutions_reporting: { current: 5, change_pct: '+25%', series: [2, 3, 4, 5, 5] },
    students_verified: { current: 1201, change_pct: '+18%', series: [300, 600, 900, 1201] },
    open_findings: { current: 5, change_pct: '-42%', series: [12, 10, 8, 5] },
    over_intake_cases: { current: 1, change_pct: '-66%', series: [3, 2, 2, 1] },
  };

  const states = stateMap?.states || [];

  const contentHtml = `
    <!-- Page Header & Greeting -->
    <div class="page-header">
      <div class="page-header-text">
        <h1>Regulatory Scrutiny & Oversight</h1>
        <p>National multi-institution monitoring, intake compliance, and privacy-preserving identity checks.</p>
      </div>
      <div class="page-actions">
        <a href="#/officer/findings" class="btn btn-primary btn-sm">
          ${iconHtml('alert-triangle', 'icon-sm')} View open findings (5)
        </a>
        <a href="#/officer/audit" class="btn btn-secondary btn-sm">
          ${iconHtml('history', 'icon-sm')} Verify audit chain
        </a>
      </div>
    </div>

    <!-- Getting Started Checklist -->
    <div class="card" style="margin-bottom: var(--space-6); background: linear-gradient(135deg, rgba(20, 48, 122, 0.04) 0%, rgba(232, 115, 26, 0.04) 100%);">
      <div class="card-body" style="padding: var(--space-4) var(--space-5);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
          <h4 style="color: var(--navy); margin: 0; display: flex; align-items: center; gap: 6px;">
            ${iconHtml('check-square', 'icon-sm')} Officer Daily Scrutiny Checklist
          </h4>
          <span style="font-size: 0.78rem; color: var(--text-muted);">2 of 4 tasks remaining</span>
        </div>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px; font-size: 0.82rem;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="color: var(--green);">✓</span> 5 canonical archetypes seeded & healthy
          </div>
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="color: var(--green);">✓</span> Cryptographic hash chain verified intact
          </div>
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="color: var(--saffron);">⏳</span>
            <a href="#/officer/findings" style="color: var(--text-main); font-weight: 500;">Review 1 over-intake breach at Bhaskara</a>
          </div>
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="color: var(--saffron);">⏳</span>
            <a href="#/officer/duplicates" style="color: var(--text-main); font-weight: 500;">Inspect cross-institution duplicate #554433221100</a>
          </div>
        </div>
      </div>
    </div>

    <!-- 4 KPI Sparkline Cards -->
    <div class="stat-card-grid">
      ${renderStatCard({
        label: 'Institutions Monitored',
        value: kpis.institutions_reporting.current,
        trendPct: kpis.institutions_reporting.change_pct,
        trendDir: 'up',
        series: kpis.institutions_reporting.series,
        id: 'kpi_institutions',
      })}
      ${renderStatCard({
        label: 'Admitted Students',
        value: kpis.students_verified.current,
        trendPct: kpis.students_verified.change_pct,
        trendDir: 'up',
        series: kpis.students_verified.series,
        id: 'kpi_students',
      })}
      ${renderStatCard({
        label: 'Open Regulatory Findings',
        value: kpis.open_findings.current,
        trendPct: kpis.open_findings.change_pct,
        trendDir: 'down',
        series: kpis.open_findings.series,
        id: 'kpi_findings',
      })}
      ${renderStatCard({
        label: 'Over-Intake Breaches',
        value: kpis.over_intake_cases.current,
        trendPct: kpis.over_intake_cases.change_pct,
        trendDir: 'down',
        series: kpis.over_intake_cases.series,
        id: 'kpi_overintake',
      })}
    </div>

    <!-- Main Grid: State Map & Attention Queue -->
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: var(--space-6);" class="overview-split-grid">
      <!-- India State Tile Map -->
      <div class="card">
        <div class="card-header">
          <div>
            <h3>India Regional Scrutiny Map</h3>
            <small>Color indicates highest severity open finding in jurisdiction. Click to inspect.</small>
          </div>
          <span style="font-size: 0.75rem; color: var(--text-muted);">15 State Jurisdictions</span>
        </div>
        <div class="card-body">
          <div class="state-tile-grid">
            ${states
              .map(
                (st) => `
              <div class="state-tile ${st.status}" data-state="${st.name}" title="${st.name}: ${st.institutions} institutions, ${st.findings} open findings">
                <span class="state-code">${st.code}</span>
                <span class="state-badge tabular">${st.findings > 0 ? `${st.findings} alert` : 'ok'}</span>
              </div>
            `
              )
              .join('')}
          </div>
          <div style="display: flex; gap: 16px; margin-top: var(--space-4); font-size: 0.75rem; color: var(--text-muted); justify-content: center;">
            <span style="display: flex; align-items: center; gap: 4px;"><span style="width: 8px; height: 8px; border-radius: 50%; background: var(--green);"></span> Compliant</span>
            <span style="display: flex; align-items: center; gap: 4px;"><span style="width: 8px; height: 8px; border-radius: 50%; background: var(--amber);"></span> In review</span>
            <span style="display: flex; align-items: center; gap: 4px;"><span style="width: 8px; height: 8px; border-radius: 50%; background: var(--red);"></span> Action required</span>
          </div>
        </div>
      </div>

      <!-- Enrolment vs Approved Intake Chart -->
      <div class="card">
        <div class="card-header">
          <div>
            <h3>Enrolment vs Approved Intake</h3>
            <small>DEMO VALUES, not AICTE rules; configure from Approval Process Handbook</small>
          </div>
          <span class="status-pill status-look">1 Over-Intake</span>
        </div>
        <div class="card-body" style="height: 280px; position: relative;">
          <canvas id="intakeBarChart" style="width: 100%; height: 100%;"></canvas>
        </div>
      </div>
    </div>

    <!-- "Needs Your Attention" Queue Table -->
    <div class="card" style="margin-bottom: var(--space-6);">
      <div class="card-header">
        <div>
          <h3>Needs Your Attention Queue</h3>
          <small>Critical and high severity validation issues requiring officer review or action</small>
        </div>
        <a href="#/officer/findings" class="btn btn-secondary btn-sm">View all triage findings</a>
      </div>
      <div class="card-body" style="padding: 0;">
        <table class="data-table">
          <thead>
            <tr>
              <th>Institution</th>
              <th>Rule Violated</th>
              <th>Severity</th>
              <th>Plain Explanation</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <div style="font-weight: 600;">Bhaskara College of Engg.</div>
                <small style="color: var(--text-muted);">1-1090234567 · Maharashtra</small>
              </td>
              <td><code>SEAT_CAP_REGULAR</code></td>
              <td>${statusPill('problem', 'Critical')}</td>
              <td>Admitted CSE intake (128) exceeds approved sanctioned ceiling (120) by 8 students.</td>
              <td>
                <a href="#/officer/institutions/1-1090234567" class="btn btn-secondary btn-sm">Inspect</a>
              </td>
            </tr>
            <tr>
              <td>
                <div style="font-weight: 600;">Chanakya Tech. University</div>
                <small style="color: var(--text-muted);">1-1090345678 · Karnataka</small>
              </td>
              <td><code>DUPLICATE_CROSS_INSTITUTION</code></td>
              <td>${statusPill('problem', 'Critical')}</td>
              <td>Concurrent active full-time enrolment detected with Aryabhata Institute.</td>
              <td>
                <a href="#/officer/duplicates" class="btn btn-secondary btn-sm">Compare</a>
              </td>
            </tr>
            <tr>
              <td>
                <div style="font-weight: 600;">Dronacharya Inst. of Science</div>
                <small style="color: var(--text-muted);">1-1090456789 · Telangana</small>
              </td>
              <td><code>MOCK_REGISTRY_MISMATCH</code></td>
              <td>${statusPill('look', 'High')}</td>
              <td>Name or date of birth differs from central APAAR identity database.</td>
              <td>
                <a href="#/officer/institutions/1-1090456789" class="btn btn-secondary btn-sm">Review</a>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  `;

  const breadcrumbs = [{ label: 'Overview', href: '#/officer/overview' }];
  container.innerHTML = renderAppShell(contentHtml, breadcrumbs);
  bindAppShellEvents();

  // Bind State Tile clicks
  container.querySelectorAll('.state-tile').forEach((tile) => {
    tile.addEventListener('click', () => {
      const stateName = tile.dataset.state;
      window.location.hash = `#/officer/institutions?search=${encodeURIComponent(stateName)}`;
    });
  });

  // Render Chart.js intake chart
  setTimeout(() => {
    renderIntakeChart();
  }, 50);
}

function renderIntakeChart() {
  const canvas = document.getElementById('intakeBarChart');
  if (!canvas || !window.Chart) return;

  new window.Chart(canvas, {
    type: 'bar',
    data: {
      labels: ['Aryabhata', 'Bhaskara (Over)', 'Chanakya', 'Dronacharya', 'Eklavya'],
      datasets: [
        {
          label: 'Admitted Students',
          data: [236, 252, 238, 240, 235],
          backgroundColor: '#14307a',
          borderRadius: 4,
        },
        {
          label: 'Sanctioned Approved Cap',
          data: [240, 240, 240, 240, 240],
          backgroundColor: '#e2e8f0',
          borderRadius: 4,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } },
      },
      scales: {
        y: {
          beginAtZero: true,
          suggestedMax: 280,
          grid: { color: 'rgba(0,0,0,0.05)' },
        },
        x: {
          grid: { display: false },
        },
      },
    },
  });
}
