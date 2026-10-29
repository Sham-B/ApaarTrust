/**
 * Officer Rules & Limits Viewer Page
 * Read-only view of YAML validation checks and supernumerary caps with DEMO VALUES disclosure
 */

import { renderAppShell, bindAppShellEvents } from '../ui/AppShell.js';
import { iconHtml } from '../ui/icons.js';

export async function renderOfficerRules(container) {
  const validationRules = [
    { id: 'APAAR_CHECKSUM', severity: 'critical', desc: 'Validates 12-digit APAAR format and Verhoeff checksum algorithm.' },
    { id: 'SEAT_CAP_REGULAR', severity: 'critical', desc: 'Ensures admitted regular quota roll does not exceed sanctioned intake ceiling.' },
    { id: 'SUPERNUMERARY_TFW', severity: 'high', desc: 'Tuition Fee Waiver quota cap check (DEMO VALUES, not AICTE rules; configure from the Approval Process Handbook).' },
    { id: 'SUPERNUMERARY_EWS', severity: 'high', desc: 'Economically Weaker Section supernumerary cap (DEMO VALUES, not AICTE rules; configure from the Approval Process Handbook).' },
    { id: 'SUPERNUMERARY_KM', severity: 'medium', desc: 'Kashmiri Migrant supernumerary quota (DEMO VALUES, not AICTE rules; configure from the Approval Process Handbook).' },
    { id: 'SUPERNUMERARY_NRI_OCI_FN', severity: 'high', desc: 'NRI, OCI, and Foreign National admission quotas (DEMO VALUES, not AICTE rules; configure from the Approval Process Handbook).' },
    { id: 'DUPLICATE_CROSS_INSTITUTION', severity: 'critical', desc: 'Cross-checks HMAC-SHA256 tokens against concurrent active tenure in other approved institutions.' },
    { id: 'MOCK_REGISTRY_MISMATCH', severity: 'high', desc: 'Validates submitted identity attributes against the central APAAR registry signatures.' },
    { id: 'ACADEMIC_YEAR_FORMAT', severity: 'medium', desc: 'Ensures academic session follows AICTE standard format (e.g. 2024-25).' },
    { id: 'CATEGORY_DOCUMENTATION', severity: 'low', desc: 'Checks required affirmative action quota certificates.' },
  ];

  const contentHtml = `
    <div class="page-header">
      <div class="page-header-text">
        <h1>Validation Checks & Regulatory Rules</h1>
        <p>Declarative rule parameters loaded from YAML files. Read-only officer audit view.</p>
      </div>
    </div>

    <!-- Mandatory Demonstration Values Notice -->
    <div class="card" style="margin-bottom: var(--space-6); background: var(--status-look-bg); border-left: 4px solid var(--amber);">
      <div class="card-body" style="padding: 14px 20px;">
        <strong style="color: var(--status-look-text);">Regulatory Disclosure:</strong>
        <p style="color: var(--status-look-text); font-size: 0.85rem; margin-top: 2px;">
          DEMO VALUES, not AICTE rules; configure from the Approval Process Handbook. The caps shown in this prototype illustrate automated ceiling validation.
        </p>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <div>
          <h3>Active Rule Set (14 Rules Configured)</h3>
          <small>Grounded source for the offline AI Compliance Copilot</small>
        </div>
        <span class="status-pill status-good">YAML Rules Loaded</span>
      </div>

      <div class="card-body" style="padding: 0;">
        <table class="data-table">
          <thead>
            <tr>
              <th>Rule Code</th>
              <th>Severity</th>
              <th>Description & Approval Process Handbook Norm</th>
            </tr>
          </thead>
          <tbody>
            ${validationRules
              .map(
                (r) => `
              <tr>
                <td><code>${r.id}</code></td>
                <td><span class="status-pill status-${r.severity === 'critical' ? 'problem' : r.severity === 'high' ? 'look' : 'waiting'}">${r.severity.toUpperCase()}</span></td>
                <td>${r.desc}</td>
              </tr>
            `
              )
              .join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;

  const breadcrumbs = [
    { label: 'Overview', href: '#/officer/overview' },
    { label: 'Rules & Limits', href: '#/officer/rules' },
  ];

  container.innerHTML = renderAppShell(contentHtml, breadcrumbs);
  bindAppShellEvents();
}
