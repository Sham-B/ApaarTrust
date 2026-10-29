/**
 * College Upload Data Page (3-Step Wizard)
 * Step 1: Download Template
 * Step 2: Check File Dry Run (Drag-and-drop, GOV.UK error summary, row errors, live seat gauge preview, nothing saved reassurance)
 * Step 3: Fix & Commit
 */

import { api } from '../api.js';
import { renderAppShell, bindAppShellEvents } from '../ui/AppShell.js';
import { renderStepper } from '../ui/Stepper.js';
import { renderSeatGauge } from '../ui/Gauge.js';
import { statusPill } from '../ui/StatusPill.js';
import { openModal } from '../ui/Modal.js';
import { iconHtml } from '../ui/icons.js';

export async function renderCollegeUpload(container) {
  let activeStep = 1; // 0: Download Template, 1: Check File Dry Run, 2: Commit
  let selectedFile = null;
  let dryRunResult = null;

  const steps = [
    { title: 'Download Template' },
    { title: 'Dry-Run Check' },
    { title: 'Review & Commit' },
  ];

  function renderView() {
    const contentHtml = `
      <div class="page-header">
        <div class="page-header-text">
          <h1>Student Intake Upload Wizard</h1>
          <p>Submit and validate student admission spreadsheets against AICTE intake ceilings and verification checks.</p>
        </div>
      </div>

      <!-- Stepper Header -->
      ${renderStepper(steps, activeStep)}

      <!-- Step 1: Download Template -->
      ${
        activeStep === 0
          ? `
        <div class="card" style="max-width: 800px; margin: 0 auto;">
          <div class="card-header">
            <h3>Step 1: Download Standard AICTE Template</h3>
            <span class="status-pill status-good">Template Ready</span>
          </div>
          <div class="card-body">
            <p style="margin-bottom: var(--space-4);">
              Download the official standardized student intake spreadsheet. Ensure all required columns (APAAR ID, Full Name, DOB, Programme, Admission Quota) are populated.
            </p>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-4); margin-bottom: var(--space-6);">
              <div style="background: var(--bg-subtle); padding: 16px; border-radius: var(--radius-sm); border: 1px solid var(--border-subtle);">
                <strong style="color: var(--navy); display: block; margin-bottom: 6px;">Clean Standard Template</strong>
                <p style="font-size: 0.82rem; color: var(--text-muted); margin-bottom: 12px;">Valid mock student roster ready to pass all validation checks cleanly.</p>
                <div style="display: flex; gap: 8px;">
                  <a href="${typeof window.apiUrl === 'function' ? window.apiUrl('/api/v1/upload/template?format=xlsx') : '/api/v1/upload/template?format=xlsx'}" class="btn btn-primary btn-sm" download>
                    ${iconHtml('download', 'icon-sm')} Excel (.xlsx)
                  </a>
                  <a href="${typeof window.apiUrl === 'function' ? window.apiUrl('/api/v1/upload/template?format=csv') : '/api/v1/upload/template?format=csv'}" class="btn btn-secondary btn-sm" download>
                    ${iconHtml('download', 'icon-sm')} CSV (.csv)
                  </a>
                </div>
              </div>

              <div style="background: rgba(232, 115, 26, 0.05); padding: 16px; border-radius: var(--radius-sm); border: 1px solid rgba(232, 115, 26, 0.2);">
                <strong style="color: var(--saffron); display: block; margin-bottom: 6px;">Sample with 5 Deliberate Errors</strong>
                <p style="font-size: 0.82rem; color: var(--text-muted); margin-bottom: 12px;">Pre-loaded with checksum defects, duplicate quota rows, and age breaches.</p>
                <div style="display: flex; gap: 8px;">
                  <a href="${typeof window.apiUrl === 'function' ? window.apiUrl('/api/v1/upload/template?format=xlsx&sample_type=errors') : '/api/v1/upload/template?format=xlsx&sample_type=errors'}" class="btn btn-secondary btn-sm" download>
                    ${iconHtml('download', 'icon-sm')} Errors (.xlsx)
                  </a>
                  <a href="${typeof window.apiUrl === 'function' ? window.apiUrl('/api/v1/upload/template?format=csv&sample_type=errors') : '/api/v1/upload/template?format=csv&sample_type=errors'}" class="btn btn-ghost btn-sm" download>
                    ${iconHtml('download', 'icon-sm')} Errors (.csv)
                  </a>
                </div>
              </div>
            </div>
            <div style="border-top: 1px solid var(--border-subtle); padding-top: var(--space-4); display: flex; justify-content: flex-end;">
              <button class="btn btn-primary" id="btnGoToStep2">
                Continue to Dry-Run Check ${iconHtml('arrow-right', 'icon-sm')}
              </button>
            </div>
          </div>
        </div>
      `
          : ''
      }

      <!-- Step 2: Check My File (Dry Run) -->
      ${
        activeStep === 1
          ? `
        <div style="max-width: 900px; margin: 0 auto; display: flex; flex-direction: column; gap: var(--space-6);">
          <!-- Reassurance Notice -->
          <div class="card" style="background: var(--status-waiting-bg); border-left: 4px solid var(--blue);">
            <div class="card-body" style="padding: 12px 18px; font-size: 0.85rem; color: var(--status-waiting-text); display: flex; align-items: center; gap: 8px;">
              ${iconHtml('shield-check', 'icon-md')}
              <div>
                <strong>Simulation Only:</strong> Nothing is saved to the central database until you explicitly review and click Commit in Step 3. You can safely test draft files here.
              </div>
            </div>
          </div>

          <!-- File Dropzone -->
          <div class="card">
            <div class="card-body">
              <div class="file-dropzone" id="fileDropzone">
                <div style="color: var(--navy); margin-bottom: var(--space-2);">${iconHtml('upload-cloud', 'icon-lg')}</div>
                <h4 style="margin-bottom: 4px;">Drag and drop your intake spreadsheet here</h4>
                <p style="font-size: 0.82rem; color: var(--text-muted); margin-bottom: var(--space-3);">Supports XLSX and CSV files up to 20MB</p>
                <input type="file" id="fileInput" accept=".xlsx,.csv" style="display: none;" />
                <button class="btn btn-secondary btn-sm" id="btnBrowseFile" type="button">
                  Browse files
                </button>
                <div id="selectedFileName" style="margin-top: 10px; font-weight: 600; font-size: 0.85rem; color: var(--navy);"></div>
              </div>

              <!-- Quick-Load Demo Sample Chips -->
              <div style="margin-top: 16px; padding: 12px; background: var(--bg-subtle); border-radius: var(--radius-sm); display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px;">
                <span style="font-size: 0.8rem; color: var(--text-muted);">
                  ${iconHtml('sparkles', 'icon-sm')} <strong>Quick Demo Mode:</strong> Load sample file directly into form:
                </span>
                <div style="display: flex; gap: 8px;">
                  <button type="button" class="btn btn-secondary btn-sm" id="btnQuickLoadClean">
                    Load Clean Sample
                  </button>
                  <button type="button" class="btn btn-ghost btn-sm" id="btnQuickLoadErrors">
                    Load Sample with 5 Errors
                  </button>
                </div>
              </div>

              <div style="display: flex; justify-content: space-between; align-items: center; margin-top: var(--space-4);">
                <button class="btn btn-ghost btn-sm" id="btnBackToStep1">
                  ${iconHtml('arrow-left', 'icon-sm')} Back to Step 1
                </button>
                <button class="btn btn-primary" id="btnRunDryRun" ${!selectedFile ? 'disabled' : ''}>
                  ${iconHtml('zap', 'icon-sm')} Run dry-run validation check
                </button>
              </div>
            </div>
          </div>

          <!-- Dry-Run Results Area (If evaluated) -->
          ${
            dryRunResult
              ? `
            <div id="dryRunResultsContainer">
              <!-- Live Seat Gauge Simulation Preview -->
              <div class="card" style="margin-bottom: var(--space-4);">
                <div class="card-header">
                  <div>
                    <h3>Simulated Intake Capacity Preview</h3>
                    <small>DEMO VALUES, not AICTE rules; configure from Approval Process Handbook</small>
                  </div>
                  <span class="status-pill status-${dryRunResult.findings_count > 0 ? 'look' : 'good'}">
                    ${dryRunResult.findings_count > 0 ? 'Findings Detected' : 'Capacity Compliant'}
                  </span>
                </div>
                <div class="card-body" style="padding: 16px; display: flex; align-items: center; justify-content: space-around;">
                  <div>
                    <div style="font-size: 0.82rem; color: var(--text-muted);">Total Batch Rows</div>
                    <div style="font-size: 1.5rem; font-weight: 700; color: var(--navy);">${dryRunResult.total_rows}</div>
                  </div>
                  <div>
                    <div style="font-size: 0.82rem; color: var(--text-muted);">Valid Student Records</div>
                    <div style="font-size: 1.5rem; font-weight: 700; color: var(--green);">${dryRunResult.valid_rows || (dryRunResult.total_rows - dryRunResult.findings_count)}</div>
                  </div>
                  <div>
                    <div style="font-size: 0.82rem; color: var(--text-muted);">Flagged Defects</div>
                    <div style="font-size: 1.5rem; font-weight: 700; color: ${dryRunResult.findings_count > 0 ? 'var(--red)' : 'var(--text-muted)'};">${dryRunResult.findings_count}</div>
                  </div>
                </div>
              </div>

              <!-- GOV.UK Style Error Summary if findings exist -->
              ${
                dryRunResult.findings_count > 0
                  ? `
                <div class="error-summary">
                  <h4>There is a problem: ${dryRunResult.findings_count} validation findings flagged</h4>
                  <p style="font-size: 0.85rem; margin-bottom: 8px;">Click an item to scroll directly to the row:</p>
                  <ul>
                    ${dryRunResult.findings.map((f, idx) => `
                      <li>
                        <a href="#finding-row-${idx}" style="color: var(--red); font-weight: 600;">
                          Row ${f.row_number || 'Batch'}: ${f.plain_reason}
                        </a>
                      </li>
                    `).join('')}
                  </ul>
                  <div style="margin-top: 14px;">
                    <a href="${typeof window.apiUrl === 'function' ? window.apiUrl('/api/v1/upload/export-errors') : '/api/v1/upload/export-errors'}" class="btn btn-secondary btn-sm" download="validation_errors.csv">
                      ${iconHtml('download', 'icon-sm')} Download Error CSV
                    </a>
                  </div>
                </div>
              `
                  : `
                <div class="card" style="background: var(--status-good-bg); border-left: 4px solid var(--green); margin-bottom: var(--space-4);">
                  <div class="card-body" style="padding: 12px 18px; color: var(--status-good-text); font-weight: 600;">
                    ✓ Zero validation errors detected! All ${dryRunResult.total_rows} student records passed pre-checks cleanly.
                  </div>
                </div>
              `
              }

              <!-- Row-level Table with Inline "How to fix" -->
              <div class="card" style="margin-bottom: var(--space-4);">
                <div class="card-header">
                  <div>
                    <h3>Validation Findings & Recommended Fixes</h3>
                    <small>Review individual issues before proceeding to permanent commit</small>
                  </div>
                  <span class="status-pill status-${dryRunResult.findings_count > 0 ? 'problem' : 'good'}">
                    ${dryRunResult.findings_count} Issues
                  </span>
                </div>
                <div class="card-body" style="padding: 0;">
                  <table class="data-table">
                    <thead>
                      <tr>
                        <th>Row</th>
                        <th>Rule ID</th>
                        <th>Severity</th>
                        <th>Reason</th>
                        <th>How to Fix</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${dryRunResult.findings
                        .map(
                          (f, idx) => `
                        <tr id="finding-row-${idx}">
                          <td><span class="tabular font-medium">Row ${f.row_number || 'Batch'}</span></td>
                          <td><code>${f.rule_id}</code></td>
                          <td>${statusPill(f.severity === 'critical' ? 'problem' : 'look', f.severity.toUpperCase())}</td>
                          <td>${f.plain_reason}</td>
                          <td style="color: var(--navy); font-size: 0.82rem;">${f.fix_hint || 'Verify admission register against sanctioned Approval Process Handbook ceilings.'}</td>
                        </tr>
                      `
                        )
                        .join('')}
                    </tbody>
                  </table>
                </div>
              </div>

              <!-- Action Bar to Step 3 -->
              <div style="display: flex; justify-content: flex-end; gap: 12px;">
                <button class="btn btn-primary" id="btnGoToStep3">
                  Proceed to Review & Commit ${iconHtml('arrow-right', 'icon-sm')}
                </button>
              </div>
            </div>
          `
              : ''
          }
        </div>
      `
          : ''
      }

      <!-- Step 3: Review & Commit -->
      ${
        activeStep === 2
          ? `
        <div class="card" style="max-width: 800px; margin: 0 auto;">
          <div class="card-header">
            <div>
              <h3>Step 3: Confirm and Commit Intake Batch</h3>
              <small>File: ${selectedFile?.name || 'intake_batch.xlsx'}</small>
            </div>
            <span class="status-pill status-waiting">Ready to Commit</span>
          </div>
          <div class="card-body">
            <p style="margin-bottom: var(--space-4);">
              You are about to commit <strong>${dryRunResult?.total_rows || 0} student records</strong> to the official AICTE ApaarTrust registry. This action will create versioned submissions and log an entry into the cryptographic audit trail.
            </p>

            <div style="background: var(--bg-subtle); padding: 14px; border-radius: var(--radius-sm); margin-bottom: var(--space-6); font-size: 0.85rem;">
              <div><strong>Institution:</strong> Aryabhata Institute of Technology (1-1090123456)</div>
              <div><strong>Academic Session:</strong> 2024-25</div>
              <div><strong>Total Records:</strong> ${dryRunResult?.total_rows || 0}</div>
              <div><strong>Open Findings to Record:</strong> ${dryRunResult?.findings_count || 0}</div>
            </div>

            <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--border-subtle); padding-top: var(--space-4);">
              <button class="btn btn-secondary" id="btnBackToStep2">
                ${iconHtml('arrow-left', 'icon-sm')} Back to Dry-Run Check
              </button>
              <button class="btn btn-primary" id="btnExecuteCommit">
                ${iconHtml('check', 'icon-sm')} Commit to AICTE Registry
              </button>
            </div>
          </div>
        </div>
      `
          : ''
      }
    `;

    const breadcrumbs = [
      { label: 'Overview', href: '#/college/overview' },
      { label: 'Upload Data', href: '#/college/upload' },
    ];

    container.innerHTML = renderAppShell(contentHtml, breadcrumbs);
    bindAppShellEvents();

    // Bind step navigation
    const btnGoStep2 = document.getElementById('btnGoToStep2');
    if (btnGoStep2) {
      btnGoStep2.addEventListener('click', () => {
        activeStep = 1;
        renderView();
      });
    }

    const btnBackStep1 = document.getElementById('btnBackToStep1');
    if (btnBackStep1) {
      btnBackStep1.addEventListener('click', () => {
        activeStep = 0;
        renderView();
      });
    }

    const btnGoStep3 = document.getElementById('btnGoToStep3');
    if (btnGoStep3) {
      btnGoStep3.addEventListener('click', () => {
        activeStep = 2;
        renderView();
      });
    }

    const btnBackStep2 = document.getElementById('btnBackToStep2');
    if (btnBackStep2) {
      btnBackStep2.addEventListener('click', () => {
        activeStep = 1;
        renderView();
      });
    }

    // Dropzone logic
    const dropzone = document.getElementById('fileDropzone');
    const fileInput = document.getElementById('fileInput');
    const browseBtn = document.getElementById('btnBrowseFile');
    const fileNameDisplay = document.getElementById('selectedFileName');
    const runBtn = document.getElementById('btnRunDryRun');
    const quickCleanBtn = document.getElementById('btnQuickLoadClean');
    const quickErrorsBtn = document.getElementById('btnQuickLoadErrors');

    const handleFileSelected = (file) => {
      selectedFile = file;
      if (fileNameDisplay) {
        fileNameDisplay.textContent = `Selected: ${selectedFile.name} (${Math.round(selectedFile.size / 1024)} KB)`;
      }
      if (runBtn) runBtn.disabled = false;
    };

    if (quickCleanBtn) {
      quickCleanBtn.addEventListener('click', async () => {
        try {
          quickCleanBtn.disabled = true;
          quickCleanBtn.textContent = 'Loading...';
          const tplUrl = typeof window.apiUrl === 'function' ? window.apiUrl('/api/v1/upload/template?format=csv') : '/api/v1/upload/template?format=csv';
          const res = await fetch(tplUrl);
          const text = await res.text();
          const file = new File([text], 'clean_intake_roster.csv', { type: 'text/csv' });
          handleFileSelected(file);
          window.dispatchEvent(
            new CustomEvent('apaar:toast', {
              detail: { type: 'success', message: 'Clean template loaded into form. Ready to test dry-run!' },
            })
          );
        } catch (err) {
          console.error(err);
        } finally {
          quickCleanBtn.disabled = false;
          quickCleanBtn.textContent = 'Load Clean Sample';
        }
      });
    }

    if (quickErrorsBtn) {
      quickErrorsBtn.addEventListener('click', async () => {
        try {
          quickErrorsBtn.disabled = true;
          quickErrorsBtn.textContent = 'Loading...';
          const tplUrl = typeof window.apiUrl === 'function' ? window.apiUrl('/api/v1/upload/template?format=csv&sample_type=errors') : '/api/v1/upload/template?format=csv&sample_type=errors';
          const res = await fetch(tplUrl);
          const text = await res.text();
          const file = new File([text], 'sample_with_5_errors.csv', { type: 'text/csv' });
          handleFileSelected(file);
          window.dispatchEvent(
            new CustomEvent('apaar:toast', {
              detail: { type: 'warning', message: 'Sample with 5 errors loaded. Ready to test validation detector!' },
            })
          );
        } catch (err) {
          console.error(err);
        } finally {
          quickErrorsBtn.disabled = false;
          quickErrorsBtn.textContent = 'Load Sample with 5 Errors';
        }
      });
    }

    if (browseBtn && fileInput) {
      browseBtn.addEventListener('click', () => fileInput.click());
    }

    if (fileInput) {
      fileInput.addEventListener('change', (e) => {
        if (e.target.files.length) {
          handleFileSelected(e.target.files[0]);
        }
      });
    }

    if (dropzone) {
      dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzone.classList.add('dragover');
      });
      dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
      dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.classList.remove('dragover');
        if (e.dataTransfer.files.length) {
          handleFileSelected(e.dataTransfer.files[0]);
        }
      });
    }

    // Run Dry Run Handler
    if (runBtn) {
      runBtn.addEventListener('click', async () => {
        if (!selectedFile) return;
        runBtn.disabled = true;
        runBtn.textContent = 'Simulating dry run...';

        const formData = new FormData();
        formData.append('institution_id', '1-1090123456');
        formData.append('academic_year', '2024-25');
        formData.append('file', selectedFile);

        try {
          const res = await api.postForm('/api/v1/upload/dry-run', formData);
          dryRunResult = res;
          renderView();

          window.dispatchEvent(
            new CustomEvent('apaar:toast', {
              detail: {
                type: 'success',
                message: `Dry-run simulation complete: ${res.total_rows} rows checked. Nothing saved to database.`,
              },
            })
          );
        } catch (err) {
          window.dispatchEvent(
            new CustomEvent('apaar:toast', {
              detail: { type: 'error', message: err.message || 'Dry run simulation failed.' },
            })
          );
          runBtn.disabled = false;
          runBtn.textContent = 'Run dry-run validation check';
        }
      });
    }

    // Execute Commit Handler
    const commitBtn = document.getElementById('btnExecuteCommit');
    if (commitBtn) {
      commitBtn.addEventListener('click', async () => {
        if (!selectedFile) return;
        commitBtn.disabled = true;
        commitBtn.textContent = 'Committing batch to registry...';

        const formData = new FormData();
        formData.append('institution_id', '1-1090123456');
        formData.append('academic_year', '2024-25');
        formData.append('file', selectedFile);

        try {
          const res = await api.postForm('/api/v1/upload/commit', formData);

          window.dispatchEvent(
            new CustomEvent('apaar:toast', {
              detail: {
                type: 'success',
                message: `Submission batch v${res.version} successfully committed to ApaarTrust registry!`,
              },
            })
          );

          // Open cryptographic receipt modal
          const receiptModalHtml = `
            <div style="margin-bottom: 20px;">
              <div style="background: rgba(19, 136, 8, 0.08); border-left: 4px solid var(--green); padding: 12px 16px; border-radius: var(--radius-sm); margin-bottom: 16px;">
                <strong style="color: var(--green);">Immutable Batch Receipt Generated</strong>
                <p style="font-size: 0.85rem; color: var(--text-muted); margin-top: 4px;">
                  Your intake batch has been verified, hashed, and appended to the tamper-evident AICTE registry.
                </p>
              </div>

              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 0.85rem; margin-bottom: 16px;">
                <div><strong>Submission ID:</strong> <span style="font-family: monospace;">${res.submission_id}</span></div>
                <div><strong>Version:</strong> <span class="badge">v${res.version}</span></div>
                <div><strong>Committed Rows:</strong> <span class="tabular font-bold">${res.total_rows}</span></div>
                <div><strong>Flagged Defects:</strong> <span class="tabular font-bold" style="color: ${res.flagged_count > 0 ? 'var(--red)' : 'var(--green)'};">${res.flagged_count}</span></div>
              </div>

              <div style="background: var(--bg-subtle); padding: 10px 14px; border-radius: var(--radius-sm); font-size: 0.8rem; margin-bottom: 16px;">
                <div style="font-weight: 700; color: var(--navy); margin-bottom: 4px;">SHA-256 Batch Receipt Digest:</div>
                <div style="font-family: monospace; font-size: 0.75rem; word-break: break-all; color: var(--navy);">
                  ${res.receipt_hash_sha256 || 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'}
                </div>
              </div>
            </div>
          `;

          openModal({
            title: `Batch Submission Receipt (v${res.version})`,
            bodyHtml: receiptModalHtml,
            actions: [
              {
                label: 'Close',
                variant: 'secondary',
                onClick: (close) => {
                  close();
                  window.location.hash = '#/college/submissions';
                },
              },
              {
                label: 'Issue Sample Certificate PDF',
                variant: 'primary',
                onClick: async () => {
                  try {
                    const certRes = await api.post('/api/v1/credentials/issue?student_id=1', {});
                    const certUrl = typeof window.apiUrl === 'function' ? window.apiUrl(`/api/v1/credentials/${certRes.credential_id}/certificate.pdf`) : `/api/v1/credentials/${certRes.credential_id}/certificate.pdf`;
                    window.open(certUrl, '_blank');
                  } catch (err) {
                    console.error(err);
                  }
                },
              },
              {
                label: 'View Students Roster',
                variant: 'primary',
                onClick: () => {
                  window.location.hash = '#/college/students';
                },
              },
            ],
          });
        } catch (err) {
          window.dispatchEvent(
            new CustomEvent('apaar:toast', {
              detail: { type: 'error', message: err.message || 'Commit failed.' },
            })
          );
          commitBtn.disabled = false;
          commitBtn.textContent = 'Commit to AICTE Registry';
        }
      });
    }
  }

  renderView();
}
