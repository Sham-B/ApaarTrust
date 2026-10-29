/**
 * Officer Institutions Directory Page
 * Lists all approved institutions with compliance status, intake, and open findings
 */

import { api } from '../api.js';
import { renderAppShell, bindAppShellEvents } from '../ui/AppShell.js';
import { DataTable } from '../ui/DataTable.js';
import { statusPill } from '../ui/StatusPill.js';
import { iconHtml } from '../ui/icons.js';

export async function renderOfficerInstitutions(container) {
  let institutions = [];
  try {
    institutions = await api.get('/api/v1/institutions');
  } catch (err) {
    console.error('Failed to load institutions:', err);
  }

  const contentHtml = `
    <div class="page-header">
      <div class="page-header-text">
        <h1>AICTE-Approved Institutions Directory</h1>
        <p>National regulatory monitoring of approved intake capacities, actual admitted rolls, and open validation findings.</p>
      </div>
      <div class="page-actions">
        <a href="#/officer/overview" class="btn btn-secondary btn-sm">
          ${iconHtml('arrow-left', 'icon-sm')} Back to overview
        </a>
      </div>
    </div>

    <!-- Table Container Mount Point -->
    <div id="institutionsTableContainer"></div>
  `;

  const breadcrumbs = [
    { label: 'Overview', href: '#/officer/overview' },
    { label: 'Institutions', href: '#/officer/institutions' },
  ];

  container.innerHTML = renderAppShell(contentHtml, breadcrumbs);
  bindAppShellEvents();

  // Initialize DataTable
  const tableContainer = document.getElementById('institutionsTableContainer');
  if (tableContainer) {
    const hashParts = window.location.hash.split('?');
    const queryParams = new URLSearchParams(hashParts[1] || '');
    const initialQuery = queryParams.get('search') || queryParams.get('state') || '';

    new DataTable({
      container: tableContainer,
      data: institutions,
      initialSearchQuery: initialQuery,
      exportFilename: 'aicte_institutions_directory.csv',
      columns: [
        {
          key: 'aicte_pid',
          label: 'AICTE PID',
          render: (val, row) => `
            <div>
              <a href="#/officer/institutions/${row.id}" style="font-weight: 600; font-family: var(--font-mono); color: var(--navy);">
                ${val}
              </a>
            </div>
          `,
        },
        {
          key: 'name',
          label: 'Institution Name',
          render: (val, row) => `
            <div>
              <a href="#/officer/institutions/${row.id}" style="font-weight: 600; color: var(--text-main);">
                ${val}
              </a>
              <div style="font-size: 0.78rem; color: var(--text-muted);">${row.district}, ${row.state}</div>
            </div>
          `,
        },
        {
          key: 'student_count',
          label: 'Admitted Students',
          render: (val) => `<span class="tabular font-semibold">${val}</span>`,
        },
        {
          key: 'approved_intake',
          label: 'Sanctioned Intake',
          render: (val) => `<span class="tabular">${val}</span>`,
        },
        {
          key: 'open_findings_count',
          label: 'Open Findings',
          render: (val, row) => {
            if (row.critical_findings_count > 0) {
              return `<span class="tabular font-bold" style="color: var(--red);">${val} (${row.critical_findings_count} critical)</span>`;
            }
            if (val > 0) {
              return `<span class="tabular" style="color: var(--amber);">${val} open</span>`;
            }
            return `<span class="tabular" style="color: var(--green);">0 clean</span>`;
          },
        },
        {
          key: 'compliance_status',
          label: 'Compliance Status',
          render: (val) => statusPill(val === 'compliant' ? 'good' : 'problem', val === 'compliant' ? 'Compliant' : 'Non-compliant'),
        },
        {
          key: 'actions',
          label: 'Action',
          sortable: false,
          render: (_, row) => `
            <a href="#/officer/institutions/${row.id}" class="btn btn-secondary btn-sm">
              Inspect ${iconHtml('arrow-right', 'icon-sm')}
            </a>
          `,
        },
      ],
    });
  }
}
