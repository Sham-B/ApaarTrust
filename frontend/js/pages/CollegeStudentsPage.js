/**
 * College Students Roster Page
 */

import { api } from '../api.js';
import { renderAppShell, bindAppShellEvents } from '../ui/AppShell.js';
import { DataTable } from '../ui/DataTable.js';
import { statusPill } from '../ui/StatusPill.js';
import { iconHtml } from '../ui/icons.js';

export async function renderCollegeStudents(container) {
  let students = [];
  try {
    students = await api.get('/api/v1/institutions/1-1090123456/students');
  } catch (err) {
    console.error('Failed to load students:', err);
  }

  const contentHtml = `
    <div class="page-header">
      <div class="page-header-text">
        <h1>Admitted Student Roster</h1>
        <p>Enrolled student cohort for Aryabhata Institute of Technology (AY 2024-25).</p>
      </div>
      <div class="page-actions">
        <a href="#/college/upload" class="btn btn-primary btn-sm">
          ${iconHtml('plus', 'icon-sm')} Upload additional batch
        </a>
      </div>
    </div>

    <div id="studentsTableMount"></div>
  `;

  const breadcrumbs = [
    { label: 'Overview', href: '#/college/overview' },
    { label: 'Students', href: '#/college/students' },
  ];

  container.innerHTML = renderAppShell(contentHtml, breadcrumbs);
  bindAppShellEvents();

  const mount = document.getElementById('studentsTableMount');
  if (mount) {
    new DataTable({
      container: mount,
      data: students,
      exportFilename: 'aryabhata_students_roster.csv',
      columns: [
        {
          key: 'student_id',
          label: 'Roll ID',
          render: (val) => `<span class="tabular font-medium">${val}</span>`,
        },
        {
          key: 'apaar_id',
          label: 'Masked APAAR ID',
          render: (val) => `<span class="tabular font-mono">${val}</span>`,
        },
        {
          key: 'name',
          label: 'Student Name',
          render: (val) => `<strong>${val}</strong>`,
        },
        {
          key: 'programme',
          label: 'Programme',
        },
        {
          key: 'admission_quota',
          label: 'Quota',
          render: (val) => statusPill('waiting', val),
        },
        {
          key: 'enrolment_status',
          label: 'Status',
          render: (val) => statusPill('good', val || 'Active'),
        },
        {
          key: 'actions',
          label: 'Actions',
          sortable: false,
          render: (_, row) => `
            <button class="btn btn-secondary btn-sm btn-issue-cert" data-student-id="${row.id}">
              ${iconHtml('file-text', 'icon-sm')} Certificate PDF
            </button>
          `,
        },
      ],
    });

    mount.addEventListener('click', async (e) => {
      const btn = e.target.closest('.btn-issue-cert');
      if (!btn) return;
      const studentId = btn.dataset.studentId;
      btn.disabled = true;
      btn.innerHTML = `<span class="spinner" style="width: 12px; height: 12px; border-width: 2px;"></span> Generating...`;

      try {
        const res = await api.post(`/api/v1/credentials/issue?student_id=${studentId}`, {});
        const credId = res.credential_id;
        const certUrl = typeof window.apiUrl === 'function' ? window.apiUrl(`/api/v1/credentials/${credId}/certificate.pdf`) : `/api/v1/credentials/${credId}/certificate.pdf`;

        window.dispatchEvent(
          new CustomEvent('apaar:toast', {
            detail: {
              type: 'success',
              message: 'Sample ReportLab certificate with signed QR seal generated!',
            },
          })
        );

        window.open(certUrl, '_blank');
      } catch (err) {
        window.dispatchEvent(
          new CustomEvent('apaar:toast', {
            detail: {
              type: 'error',
              message: err.message || 'Failed to issue certificate.',
            },
          })
        );
      } finally {
        btn.disabled = false;
        btn.innerHTML = `${iconHtml('file-text', 'icon-sm')} Certificate PDF`;
      }
    });
  }
}

