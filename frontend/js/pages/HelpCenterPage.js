/**
 * ApaarTrust Help Center, Guides & Compliance Glossary Page
 */

import { store } from '../store.js';
import { renderAppShell } from '../ui/AppShell.js';
import { GLOSSARY_TERMS, initGlossaryPopovers } from '../ui/glossary.js';

export async function renderHelpCenter(container) {
  const { role } = store.getState();
  const searchParams = new URLSearchParams(window.location.hash.split('?')[1] || '');
  const initialQuery = searchParams.get('q') || '';

  const guides = [
    {
      role: 'Officer',
      title: 'Triaging Regulatory Compliance Findings',
      summary: 'How to inspect flagged over-intake cases, analyze benign hypotheses, and issue formal notices.',
      steps: [
        'Open the Findings Inbox from the navigation sidebar to view items sorted by priority.',
        'Click on any finding row to slide out the evidence drawer containing rule IDs and registry diffs.',
        'Review the benign explanations (e.g., late student cancellations or data entry errors).',
        'If an adverse action is warranted, enter a mandatory minimum 10-character written reason before submitting.'
      ]
    },
    {
      role: 'Officer',
      title: 'Auditing Integrity & Tamper Detection',
      summary: 'Verifying the SHA-256 cryptographic chain of all officer actions and identity reveals.',
      steps: [
        'Navigate to Audit Log in the sidebar.',
        'Click "Verify Audit Integrity" to recompute hashes from the genesis block.',
        'Test the "Simulate Tamper Demo" button to observe how any unauthorized database alteration is caught immediately.'
      ]
    },
    {
      role: 'College',
      title: 'Uploading Student Intake via 3-Step Wizard',
      summary: 'Download spreadsheet templates, run zero-commitment dry runs, and resolve validation errors.',
      steps: [
        'Download the official CSV or XLSX template from the Upload Data page.',
        'Populate student data including 12-digit APAAR numbers, admission dates, and quota categories.',
        'Drag and drop the spreadsheet into Step 2: Dry-Run. The system checks all 14 rules without saving anything to the database.',
        'Inspect the GOV.UK style error summary for row-level fixes.',
        'Proceed to Step 3 only when all checks pass to commit the batch and generate a new version.'
      ]
    },
    {
      role: 'College',
      title: 'Issuing Verifiable Sample Certificates',
      summary: 'Generate digitally sealed PDF certificates with offline-verifiable QR codes.',
      steps: [
        'Navigate to Certificates from the College sidebar.',
        'Select any enrolled student from the roster.',
        'Click "Generate Sample Certificate" to create an Ed25519-signed document with selective disclosure QR.',
        'Download the PDF or verify it instantly in the Public Verifier.'
      ]
    },
    {
      role: 'Student',
      title: 'Managing Sovereign Consent & Disclosures',
      summary: 'How to control field-level visibility and revoke access to your academic records.',
      steps: [
        'Go to Consent Management from the Student sidebar.',
        'Create or edit a consent grant for a specific verification purpose (e.g., Campus Placement).',
        'Toggle off sensitive attributes like Date of Birth or Social Category.',
        'Check the live preview to confirm what verifiers can and cannot see.',
        'Click "Revoke" at any time to instantly block subsequent verification attempts.'
      ]
    },
    {
      role: 'Verifier',
      title: 'Verifying Credentials Offline Without Network Calls',
      summary: 'How employers and universities verify authenticity mathematically.',
      steps: [
        'Visit the Public Verifier at #/verify.',
        'Upload any ApaarTrust Certificate PDF or scan the embedded QR seal.',
        'The cryptographic engine checks the Ed25519 signature against AICTE public keys.',
        'Inspect the Disclosed vs Withheld attributes panel for immediate genuine/revoked/tampered status.'
      ]
    }
  ];

  const contentHtml = `
    <div class="page-container">
      <div class="page-header">
        <div class="page-header-title">
          <h1>Help Center, Guides & Glossary</h1>
          <p class="page-header-subtitle">
            Searchable documentation, step-by-step role guides, and regulatory terminology for the ApaarTrust platform.
          </p>
        </div>
        <div class="page-header-actions">
          <button id="btn-start-tour-help" class="btn btn-secondary">
            <svg class="icon"><use href="vendor/lucide-sprite.svg#compass"></use></svg>
            Take Guided Tour
          </button>
        </div>
      </div>

      <!-- Live Search Bar -->
      <div class="card" style="margin-bottom: 32px; background: var(--bg-surface-elevated); padding: 20px;">
        <div style="position: relative;">
          <input type="text" id="help-search-input" class="input" placeholder="Search guides, validation rules, or glossary terms (e.g. intake, supernumerary, consent)..." value="${initialQuery}" style="padding-left: 40px; font-size: 15px;" />
          <svg class="icon" style="position: absolute; left: 14px; top: 50%; transform: translateY(-50%); color: var(--text-muted); width: 18px; height: 18px;"><use href="vendor/lucide-sprite.svg#search"></use></svg>
        </div>
      </div>

      <!-- Quick Category Nav Tabs -->
      <div class="tabs" style="margin-bottom: 24px;">
        <button class="tab-button active" id="tab-guides">
          <svg class="icon"><use href="vendor/lucide-sprite.svg#book-open"></use></svg>
          How-To Guides (${guides.length})
        </button>
        <button class="tab-button" id="tab-glossary">
          <svg class="icon"><use href="vendor/lucide-sprite.svg#file-text"></use></svg>
          Regulatory Glossary (${Object.keys(GLOSSARY_TERMS).length})
        </button>
      </div>

      <!-- Section 1: How-To Guides -->
      <div id="section-guides">
        <div class="grid grid-2" style="gap: 20px;" id="guides-grid">
          ${guides.map((g, idx) => `
            <div class="card guide-card" data-role="${g.role}" data-text="${(g.title + ' ' + g.summary + ' ' + g.steps.join(' ')).toLowerCase()}">
              <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
                <span class="badge" style="font-size: 11px; text-transform: uppercase;">${g.role} Guide</span>
                <span style="font-size: 12px; color: var(--text-muted);">${g.steps.length} Steps</span>
              </div>
              <h3 style="margin: 0 0 8px 0; font-size: 16px; color: var(--primary);">
                ${g.title}
              </h3>
              <p style="font-size: 13px; color: var(--text-muted); margin: 0 0 16px 0; line-height: 1.5;">
                ${g.summary}
              </p>
              <ol style="margin: 0; padding-left: 20px; font-size: 13px; color: var(--text-color); display: flex; flex-direction: column; gap: 6px;">
                ${g.steps.map(step => `<li>${step}</li>`).join('')}
              </ol>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- Section 2: Glossary (Hidden by default or toggled) -->
      <div id="section-glossary" style="display: none;">
        <div class="card" style="background: rgba(232, 115, 26, 0.04); border-left: 4px solid var(--warning); margin-bottom: 24px;">
          <div style="font-size: 13px; color: var(--text-color); line-height: 1.5;">
            <strong>Mandatory AICTE Notice:</strong> Seat caps, percentages, and supernumerary limits shown in this platform are <strong>DEMO VALUES, not AICTE rules; configure from the Approval Process Handbook</strong>.
          </div>
        </div>

        <div class="grid grid-2" style="gap: 20px;" id="glossary-grid">
          ${Object.entries(GLOSSARY_TERMS).map(([k, t]) => `
            <div class="card glossary-card" data-key="${k}" data-text="${(t.term + ' ' + t.title + ' ' + t.definition).toLowerCase()}">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <strong style="font-size: 16px; color: var(--primary);">${t.term}</strong>
                <span class="badge">${t.category}</span>
              </div>
              <div style="font-size: 13px; font-weight: 600; color: var(--text-color); margin-bottom: 6px;">
                ${t.title}
              </div>
              <p style="font-size: 13px; color: var(--text-muted); line-height: 1.5; margin: 0;">
                ${t.definition}
              </p>
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `;

  if (role) {
    renderAppShell(container, contentHtml, 'help');
  } else {
    container.innerHTML = contentHtml;
  }

  // Initialize Glossary popovers
  initGlossaryPopovers(container);

  // Tab switching
  const tabGuides = container.querySelector('#tab-guides');
  const tabGlossary = container.querySelector('#tab-glossary');
  const secGuides = container.querySelector('#section-guides');
  const secGlossary = container.querySelector('#section-glossary');

  tabGuides.addEventListener('click', () => {
    tabGuides.classList.add('active');
    tabGlossary.classList.remove('active');
    secGuides.style.display = 'block';
    secGlossary.style.display = 'none';
  });

  tabGlossary.addEventListener('click', () => {
    tabGlossary.classList.add('active');
    tabGuides.classList.remove('active');
    secGlossary.style.display = 'block';
    secGuides.style.display = 'none';
  });

  // Tour trigger
  const tourBtn = container.querySelector('#btn-start-tour-help');
  if (tourBtn) {
    tourBtn.addEventListener('click', () => {
      window.dispatchEvent(new CustomEvent('apaar:start-tour'));
    });
  }

  // Live Search filter
  const searchInput = container.querySelector('#help-search-input');
  const filterContent = (query) => {
    const q = query.trim().toLowerCase();
    const guideCards = container.querySelectorAll('.guide-card');
    const glossCards = container.querySelectorAll('.glossary-card');

    let guidesMatched = 0;
    guideCards.forEach(c => {
      const match = !q || c.dataset.text.includes(q);
      c.style.display = match ? 'block' : 'none';
      if (match) guidesMatched++;
    });

    let glossMatched = 0;
    glossCards.forEach(c => {
      const match = !q || c.dataset.text.includes(q);
      c.style.display = match ? 'block' : 'none';
      if (match) glossMatched++;
    });

    // Auto-switch to glossary if glossary matches and guides don't
    if (guidesMatched === 0 && glossMatched > 0) {
      tabGlossary.click();
    }
  };

  searchInput.addEventListener('input', (e) => filterContent(e.target.value));
  if (initialQuery) filterContent(initialQuery);
}
