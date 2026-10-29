/**
 * Glossary Definitions and Accessible Popovers
 */

export const GLOSSARY_TERMS = {
  apaar: {
    term: 'APAAR',
    title: 'Automated Permanent Academic Account Registry',
    definition: 'A 12-digit unique lifelong digital identity for Indian students issued under the One Nation, One Student ID initiative. ApaarTrust protects this ID using salted cryptographic tokens.',
    category: 'Identity',
  },
  intake: {
    term: 'Sanctioned Intake',
    title: 'Approved Regular Intake',
    definition: 'The maximum permissible number of student admissions sanctioned by AICTE for a specific academic programme. (DEMO VALUES, not AICTE rules; configure from the Approval Process Handbook).',
    category: 'Regulatory',
  },
  supernumerary: {
    term: 'Supernumerary Quotas',
    title: 'Over-and-Above Sanctioned Seats',
    definition: 'Authorized seats allocated outside regular sanctioned intake for specific national schemes (e.g., TFW up to 5%, EWS up to 10%, PMSSS). (DEMO VALUES, not AICTE rules; configure from the Approval Process Handbook).',
    category: 'Regulatory',
  },
  nri: {
    term: 'NRI',
    title: 'Non-Resident Indian Quota',
    definition: 'Admissions reserved for non-resident Indian candidates or their wards as permitted under state and council reservation guidelines (DEMO VALUES, not AICTE rules).',
    category: 'Quota',
  },
  oci: {
    term: 'OCI',
    title: 'Overseas Citizen of India',
    definition: 'Category for foreign citizens of Indian origin holding valid OCI registration cards under the Ministry of Home Affairs.',
    category: 'Quota',
  },
  fn: {
    term: 'FN',
    title: 'Foreign Nationals',
    definition: 'International candidates holding citizenship of foreign nations admitted under bilateral cultural exchange or supernumerary quota.',
    category: 'Quota',
  },
  consent: {
    term: 'Sovereign Consent',
    title: 'Field-Level Student Authorization',
    definition: 'Digital permissions granted and managed by the student governing which organizations can verify specific attributes of their academic credential.',
    category: 'Privacy',
  },
  'selective disclosure': {
    term: 'Selective Disclosure',
    title: 'Zero-Knowledge SD-JWT Proofs',
    definition: 'Cryptographic technique allowing students to prove specific attributes (such as degree completion) without revealing sensitive data (such as birth date or caste).',
    category: 'Cryptography',
  },
};

/**
 * Initializes interactive popover tooltips for all elements with .glossary-term in container
 */
export function initGlossaryPopovers(container = document) {
  const elements = container.querySelectorAll('.glossary-term, [data-glossary]');

  elements.forEach((el) => {
    const key = (el.dataset.glossary || el.textContent || '').trim().toLowerCase();
    const entry = GLOSSARY_TERMS[key];
    if (!entry) return;

    el.setAttribute('tabindex', '0');
    el.setAttribute('role', 'button');
    el.setAttribute('aria-haspopup', 'dialog');
    el.classList.add('glossary-interactive');

    let popover = null;

    const showPopover = () => {
      if (popover) return;
      popover = document.createElement('div');
      popover.className = 'glossary-popover card';
      popover.innerHTML = `
        <div style="font-weight: 700; font-size: 13px; color: var(--primary); margin-bottom: 4px; display: flex; align-items: center; justify-content: space-between;">
          <span>${entry.title}</span>
          <span class="badge" style="font-size: 10px;">${entry.category}</span>
        </div>
        <div style="font-size: 12px; color: var(--text-color); line-height: 1.5; margin-bottom: 6px;">
          ${entry.definition}
        </div>
        <div style="font-size: 10px; color: var(--text-muted); font-style: italic;">
          Press Esc to dismiss &bull; Click to open Help Center
        </div>
      `;

      document.body.appendChild(popover);
      const rect = el.getBoundingClientRect();
      const popRect = popover.getBoundingClientRect();

      let top = rect.bottom + window.scrollY + 8;
      let left = rect.left + window.scrollX;

      if (left + popRect.width > window.innerWidth - 16) {
        left = window.innerWidth - popRect.width - 16;
      }

      popover.style.position = 'absolute';
      popover.style.top = `${top}px`;
      popover.style.left = `${Math.max(16, left)}px`;
      popover.style.zIndex = '9999';
      popover.style.maxWidth = '320px';
      popover.style.boxShadow = 'var(--shadow-lg)';
      popover.style.border = '1px solid var(--border-color)';
      popover.style.padding = '12px 14px';
      popover.style.background = 'var(--bg-surface)';
    };

    const hidePopover = () => {
      if (popover) {
        popover.remove();
        popover = null;
      }
    };

    el.addEventListener('mouseenter', showPopover);
    el.addEventListener('mouseleave', hidePopover);
    el.addEventListener('focus', showPopover);
    el.addEventListener('blur', hidePopover);

    el.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') hidePopover();
      if (e.key === 'Enter') {
        window.location.hash = `#/help?q=${encodeURIComponent(key)}`;
        hidePopover();
      }
    });

    el.addEventListener('click', (e) => {
      e.preventDefault();
      window.location.hash = `#/help?q=${encodeURIComponent(key)}`;
      hidePopover();
    });
  });
}
