/**
 * AI Compliance Assistant Drawer & Floating Launcher
 * Strictly rule-grounded offline assistant
 */

import { Drawer } from './Drawer.js';
import { api } from '../api.js';
import { store } from '../store.js';
import { previewManager } from '../preview.js';
import { queryKnowledgeBaseClientSide } from '../fixtures.js';
import { iconHtml } from './icons.js';

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function renderMarkdownLite(rawText) {
  if (!rawText) return '';
  const escaped = escapeHtml(rawText);

  // Bold **text**
  let formatted = escaped.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  // Italic *text*
  formatted = formatted.replace(/\*(.*?)\*/g, '<em>$1</em>');
  // Inline code `code`
  formatted = formatted.replace(/`([^`]+)`/g, '<code>$1</code>');

  // Convert markdown links [Label](url)
  formatted = formatted.replace(
    /\[([^\]]+)\]\((#[^)]+)\)/g,
    '<a href="$2" class="copilot-deep-link" data-link="$2">$1</a>'
  );

  // Convert bullet points
  const lines = formatted.split('\n');
  const resultLines = [];
  let inList = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      if (!inList) {
        resultLines.push('<ul>');
        inList = true;
      }
      resultLines.push(`<li>${trimmed.slice(2)}</li>`);
    } else {
      if (inList) {
        resultLines.push('</ul>');
        inList = false;
      }
      if (trimmed) {
        resultLines.push(`<p>${trimmed}</p>`);
      }
    }
  }
  if (inList) {
    resultLines.push('</ul>');
  }

  return `<div class="copilot-content">${resultLines.join('')}</div>`;
}

export class CopilotDrawer {
  constructor() {
    this.drawer = null;
    this.history = [];
    this.launcherEl = null;
    this.loadHistory();
    this.init();
  }

  loadHistory() {
    try {
      const stored = localStorage.getItem('apaar_copilot_history');
      if (stored) {
        this.history = JSON.parse(stored);
      }
    } catch (e) {
      this.history = [];
    }
  }

  saveHistory() {
    try {
      localStorage.setItem('apaar_copilot_history', JSON.stringify(this.history.slice(-30)));
    } catch (e) {
      // ignore
    }
  }

  init() {
    // Listen for custom open event
    window.addEventListener('apaar:open-copilot', (e) => {
      const query = e?.detail?.query || null;
      const context = e?.detail?.context || null;
      this.open(query, context);
    });

    // Global keyboard shortcut: Ctrl+/ or Cmd+/
    window.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === '/') {
        e.preventDefault();
        this.open();
      }
    });

    // Mount floating launcher if not present
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.mountLauncher());
    } else {
      this.mountLauncher();
    }
  }

  mountLauncher() {
    if (document.getElementById('copilotFloatingLauncher')) return;

    const launcher = document.createElement('button');
    launcher.id = 'copilotFloatingLauncher';
    launcher.className = 'copilot-floating-launcher copilot-launcher-pulse';
    launcher.setAttribute('aria-label', 'Ask ApaarTrust AI Assistant');
    launcher.title = 'Ask ApaarTrust AI Assistant (Ctrl+/)';
    launcher.innerHTML = `
      <span class="copilot-launcher-icon">${iconHtml('sparkles', 'icon-md')}</span>
      <span class="copilot-launcher-label">Ask ApaarTrust</span>
      <kbd class="copilot-launcher-kbd">Ctrl /</kbd>
    `;

    launcher.addEventListener('click', () => {
      launcher.classList.remove('copilot-launcher-pulse');
      this.open();
    });

    // Stop pulsing after 10 seconds
    setTimeout(() => {
      if (launcher) launcher.classList.remove('copilot-launcher-pulse');
    }, 10000);

    document.body.appendChild(launcher);
    this.launcherEl = launcher;
  }

  getSuggestionsForRole(role) {
    switch (role) {
      case 'Officer':
        return [
          'Which institutions are over intake?',
          'Explain this finding',
          'Why was this duplicate flagged?',
          'How many open findings do I have?',
          'What is the validation rule for NRI and OCI admissions?',
        ];
      case 'Institution':
        return [
          'How do I fix my file?',
          'What does dry run mean?',
          'What is the maximum approved intake for CSE?',
          'How many students are enrolled?',
          'What are the supernumerary quota limits for TFW and EWS?',
        ];
      case 'Student':
        return [
          'Who can see my data?',
          'How do I revoke consent?',
          'What is SD-JWT-inspired selective disclosure?',
          'Who viewed my record?',
          'How many active consents do I have?',
        ];
      case 'Verifier':
      default:
        return [
          'How does verification work?',
          'What does tampered status mean?',
          'What is the difference between genuine and revoked?',
          'How is student privacy protected?',
          'Who is authorized to take an adverse regulatory action on a submission?',
        ];
    }
  }

  open(initialQuery = null, context = null) {
    if (this.drawer) {
      this.drawer.close();
      this.drawer = null;
    }

    const { role } = store.getState();
    const suggestedChips = this.getSuggestionsForRole(role);
    const currentPage = window.location.hash || '#/';

    const contentHtml = `
      <div style="display: flex; flex-direction: column; height: 100%;">
        <!-- Header Sub-Bar -->
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-3); padding-bottom: var(--space-2); border-bottom: 1px solid var(--border-subtle);">
          <div style="display: flex; align-items: center; gap: 6px;">
            <span class="badge" style="background: var(--navy-800); color: var(--saffron); font-size: 0.72rem; padding: 2px 8px;">
              ${role || 'Public'} View
            </span>
            <span style="font-size: 0.75rem; color: var(--text-muted); font-family: var(--font-mono);">${currentPage}</span>
          </div>
          <div style="display: flex; gap: 6px;">
            <a href="#/assistant" class="btn btn-ghost btn-xs btn-fullpage-link" title="Open full page assistant">
              ${iconHtml('external-link', 'icon-xs')} Full page
            </a>
            <button class="btn btn-ghost btn-xs btn-clear-copilot" title="Clear chat history">
              ${iconHtml('trash-2', 'icon-xs')} Clear
            </button>
          </div>
        </div>

        ${context ? `
          <div style="background: var(--bg-hover); padding: 6px 10px; border-radius: var(--radius-sm); font-size: 0.78rem; color: var(--text-muted); margin-bottom: var(--space-2);">
            ${iconHtml('info', 'icon-xs')} Context: <code>${escapeHtml(typeof context === 'object' ? JSON.stringify(context) : context)}</code>
          </div>
        ` : ''}

        <p style="font-size: 0.82rem; color: var(--text-muted); margin-bottom: var(--space-3);">
          Ask questions regarding AICTE validation norms, seat matrices, or regulatory findings. Answers are verified strictly against local YAML rules and the glossary.
        </p>

        <!-- Suggested Question Chips -->
        <div class="copilot-chip-list">
          ${suggestedChips.map((chip) => `<button class="copilot-chip" data-q="${escapeHtml(chip)}">${escapeHtml(chip)}</button>`).join('')}
        </div>

        <!-- Chat Conversation Messages -->
        <div class="copilot-messages" style="flex: 1; overflow-y: auto; padding: var(--space-2) 0; min-height: 220px;">
          ${this.history.length === 0 ? `
            <div style="text-align: center; color: var(--text-subtle); padding: var(--space-6) 0;">
              ${iconHtml('sparkles', 'icon-lg')}
              <p style="margin-top: var(--space-2); font-size: 0.85rem;">Select a question above or type your inquiry below.</p>
            </div>
          ` : ''}
        </div>

        <!-- Input Box -->
        <div style="margin-top: auto; padding-top: var(--space-3); border-top: 1px solid var(--border-subtle);">
          <form class="copilot-form" style="display: flex; gap: var(--space-2);">
            <input type="text" class="form-input copilot-input" placeholder="Ask compliance or verification question..." required />
            <button type="submit" class="btn btn-primary btn-sm">
              ${iconHtml('arrow-right', 'icon-sm')} Ask
            </button>
          </form>
          <div style="font-size: 0.72rem; color: var(--text-subtle); margin-top: var(--space-2); text-align: center;">
            Demo assistant. Not legal or regulatory advice. Grounded strictly in configured YAML rules.
          </div>
        </div>
      </div>
    `;

    this.drawer = new Drawer({
      title: 'Ask ApaarTrust AI Assistant',
      content: contentHtml,
      width: '480px',
      onClose: () => {
        this.drawer = null;
      },
    });

    this.drawer.open();

    // Bind fullpage link
    const fullpageBtn = this.drawer.backdrop.querySelector('.btn-fullpage-link');
    if (fullpageBtn) {
      fullpageBtn.addEventListener('click', () => {
        if (this.drawer) this.drawer.close();
      });
    }

    // Bind clear chat
    const clearBtn = this.drawer.backdrop.querySelector('.btn-clear-copilot');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        this.history = [];
        this.saveHistory();
        this.renderHistory();
      });
    }

    // Render existing history
    this.renderHistory();

    // Chip click binding
    const chipBtns = this.drawer.backdrop.querySelectorAll('.copilot-chip');
    chipBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const q = btn.dataset.q;
        this.submitQuery(q);
      });
    });

    // Form submit binding
    const form = this.drawer.backdrop.querySelector('.copilot-form');
    const input = this.drawer.backdrop.querySelector('.copilot-input');
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const val = input.value.trim();
      if (val) {
        input.value = '';
        this.submitQuery(val);
      }
    });

    // If initial query provided, run it
    if (initialQuery) {
      this.submitQuery(initialQuery);
    }
  }

  async submitQuery(question) {
    this.history.push({ role: 'user', text: question });
    this.saveHistory();
    this.renderHistory();

    const messagesEl = this.drawer ? this.drawer.backdrop.querySelector('.copilot-messages') : document.querySelector('.assistant-fullpage-chat');
    if (!messagesEl) return;

    // Show typing animation
    const typingEl = document.createElement('div');
    typingEl.className = 'copilot-message assistant';
    typingEl.innerHTML = `
      <div style="font-weight: 600; font-size: 0.8rem; margin-bottom: 4px; color: var(--text-muted);">
        ApaarTrust Assistant is checking local YAML rules...
      </div>
      <div class="copilot-typing-indicator">
        <span></span><span></span><span></span>
      </div>
    `;
    messagesEl.appendChild(typingEl);
    messagesEl.scrollTop = messagesEl.scrollHeight;

    const { role, studentToken, institutionId } = store.getState();
    const currentPage = window.location.hash || '#/';

    try {
      let response;
      if (previewManager.isActive()) {
        const kbResult = queryKnowledgeBaseClientSide(question, role);
        response = {
          answer: kbResult.answer,
          rule_source: kbResult.found ? (kbResult.rule_source || 'knowledge_base.yaml') : null,
          modelLabel: kbResult.found ? 'client-side preview knowledge index' : 'preview mode',
          actions: kbResult.actions || [],
          suggestions: kbResult.suggestions || [
            'Which institutions are over intake?',
            'What is the maximum approved intake for CSE?',
            'How does verification work?',
          ],
        };
      } else {
        response = await api.post('/api/v1/copilot/chat', {
          message: question,
          current_page: currentPage,
          student_token: studentToken,
          institution_id: institutionId,
        });
      }

      if (typingEl.parentElement) messagesEl.removeChild(typingEl);

      this.history.push({
        role: 'assistant',
        text: response.answer,
        ruleSource: response.rule_source,
        modelLabel: response.engine || response.modelLabel || 'template explanation',
        actions: response.actions || [],
        suggestions: response.suggestions || [],
      });
      this.saveHistory();
      this.renderHistory();
    } catch (err) {
      if (typingEl.parentElement) messagesEl.removeChild(typingEl);
      const kbResult = queryKnowledgeBaseClientSide(question, role);
      this.history.push({
        role: 'assistant',
        text: kbResult.found ? kbResult.answer : 'The assistant needs the live server',
        ruleSource: kbResult.found ? kbResult.rule_source : null,
        modelLabel: kbResult.found ? 'client-side preview knowledge index' : 'live server required',
        actions: kbResult.actions || [],
        suggestions: kbResult.suggestions || [
          'Which institutions are over intake?',
          'What is the maximum approved intake for CSE?',
          'How does verification work?',
        ],
      });
      this.saveHistory();
      this.renderHistory();
    }
  }

  renderHistory() {
    const container = this.drawer ? this.drawer.backdrop.querySelector('.copilot-messages') : document.querySelector('.assistant-fullpage-chat');
    if (!container) return;

    if (!this.history.length) {
      container.innerHTML = `
        <div style="text-align: center; color: var(--text-subtle); padding: var(--space-6) 0;">
          ${iconHtml('sparkles', 'icon-lg')}
          <p style="margin-top: var(--space-2); font-size: 0.85rem;">Select a question above or type your inquiry below.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = this.history
      .map((item, idx) => {
        if (item.role === 'user') {
          return `
            <div class="copilot-message user">
              <div style="font-weight: 600; font-size: 0.75rem; color: var(--text-muted); margin-bottom: 2px;">You</div>
              <div>${escapeHtml(item.text)}</div>
            </div>
          `;
        }

        const formattedHtml = renderMarkdownLite(item.text);

        // Detect action suggestions (e.g. verify, upload, institutions, duplicates)
        let actionsHtml = '';
        const lowerText = item.text.toLowerCase();
        const actionItems = [];

        if (lowerText.includes('verify') || lowerText.includes('certificate')) {
          actionItems.push({ label: 'Show me: Public Verifier', tour: 'verify', href: '#/verify' });
        }
        if (lowerText.includes('upload') || lowerText.includes('intake') || lowerText.includes('csv')) {
          actionItems.push({ label: 'Show me: Data Upload', tour: 'upload', href: '#/college/upload' });
        }
        if (lowerText.includes('institution') || lowerText.includes('bhaskara') || lowerText.includes('over-intake')) {
          actionItems.push({ label: 'Show me: Institutions Directory', tour: 'institutions', href: '#/officer/institutions' });
        }
        if (lowerText.includes('consent') || lowerText.includes('revoke')) {
          actionItems.push({ label: 'Show me: Student Consent Manager', tour: 'consent', href: '#/student/consent' });
        }

        if (actionItems.length > 0) {
          actionsHtml = `
            <div style="display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px;">
              ${actionItems
                .map(
                  (act) => `
                <button class="btn btn-secondary btn-xs btn-copilot-action" data-tour="${act.tour}" data-href="${act.href}">
                  ${iconHtml('compass', 'icon-xs')} ${act.label}
                </button>
              `
                )
                .join('')}
            </div>
          `;
        }

        // Suggestions / Follow-up chips
        let suggestionsHtml = '';
        if (item.suggestions && item.suggestions.length > 0) {
          suggestionsHtml = `
            <div style="margin-top: 8px;">
              <div style="font-size: 0.72rem; color: var(--text-subtle); margin-bottom: 4px;">Follow-up questions:</div>
              <div class="copilot-chip-list" style="margin-bottom: 0;">
                ${item.suggestions
                  .map((s) => `<button class="copilot-chip btn-copilot-followup" data-q="${escapeHtml(s)}">${escapeHtml(s)}</button>`)
                  .join('')}
              </div>
            </div>
          `;
        }

        return `
          <div class="copilot-message assistant" data-msg-idx="${idx}">
            <div style="font-weight: 600; margin-bottom: 6px; display: flex; justify-content: space-between; align-items: center;">
              <span style="display: inline-flex; align-items: center; gap: 4px; font-size: 0.8rem; color: var(--saffron);">
                ${iconHtml('sparkles', 'icon-xs')} ApaarTrust Assistant
              </span>
              <span style="font-size: 0.68rem; padding: 1px 6px; border-radius: 4px; background: var(--bg-hover); color: var(--text-muted); font-family: var(--font-mono);">
                ${escapeHtml(item.modelLabel || 'template explanation')}
              </span>
            </div>

            ${formattedHtml}

            ${actionsHtml}

            ${item.ruleSource ? `
              <div class="copilot-citation">
                ${iconHtml('book-open', 'icon-xs')} Source: ${escapeHtml(item.ruleSource)}
              </div>
            ` : ''}

            ${suggestionsHtml}

            <!-- Action Bar: Copy, Thumbs -->
            <div class="copilot-actions">
              <button class="copilot-action-btn btn-copy-msg" title="Copy answer to clipboard">
                ${iconHtml('copy', 'icon-xs')} <span>Copy</span>
              </button>
              <button class="copilot-action-btn btn-thumb-up" title="Helpful answer">
                ${iconHtml('thumbs-up', 'icon-xs')}
              </button>
              <button class="copilot-action-btn btn-thumb-down" title="Not helpful">
                ${iconHtml('thumbs-down', 'icon-xs')}
              </button>
            </div>
          </div>
        `;
      })
      .join('');

    container.scrollTop = container.scrollHeight;

    // Bind action and feedback buttons
    this.bindMessageInteractions(container);
  }

  bindMessageInteractions(container) {
    // Copy buttons
    const copyBtns = container.querySelectorAll('.btn-copy-msg');
    copyBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const msgEl = btn.closest('.copilot-message');
        const textToCopy = msgEl ? msgEl.querySelector('.copilot-content')?.innerText || '' : '';
        if (textToCopy && navigator.clipboard) {
          navigator.clipboard.writeText(textToCopy);
          btn.innerHTML = `${iconHtml('check', 'icon-xs')} <span>Copied!</span>`;
          setTimeout(() => {
            btn.innerHTML = `${iconHtml('copy', 'icon-xs')} <span>Copy</span>`;
          }, 2000);
        }
      });
    });

    // Thumbs buttons
    const thumbUpBtns = container.querySelectorAll('.btn-thumb-up');
    thumbUpBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        btn.classList.toggle('voted-up');
        const sibling = btn.parentElement.querySelector('.btn-thumb-down');
        if (sibling) sibling.classList.remove('voted-down');
        this.saveFeedback(btn, 'up');
      });
    });

    const thumbDownBtns = container.querySelectorAll('.btn-thumb-down');
    thumbDownBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        btn.classList.toggle('voted-down');
        const sibling = btn.parentElement.querySelector('.btn-thumb-up');
        if (sibling) sibling.classList.remove('voted-up');
        this.saveFeedback(btn, 'down');
      });
    });

    // Action / Tour deep links
    const actionBtns = container.querySelectorAll('.btn-copilot-action');
    actionBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const tour = btn.dataset.tour;
        const href = btn.dataset.href;
        if (this.drawer) this.drawer.close();
        runSpotlight(tour, href);
      });
    });

    // Follow-up chips
    const followUpBtns = container.querySelectorAll('.btn-copilot-followup');
    followUpBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const q = btn.dataset.q;
        this.submitQuery(q);
      });
    });

    // Markdown inline deep links
    const deepLinks = container.querySelectorAll('.copilot-deep-link');
    deepLinks.forEach((link) => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const target = link.getAttribute('href');
        if (this.drawer) this.drawer.close();
        window.location.hash = target;
      });
    });
  }

  saveFeedback(btn, type) {
    try {
      const msgEl = btn.closest('.copilot-message');
      const idx = msgEl ? msgEl.dataset.msgIdx : null;
      const question = idx && this.history[idx - 1] ? this.history[idx - 1].text : '';
      const answer = idx && this.history[idx] ? this.history[idx].text : '';

      const feedback = JSON.parse(localStorage.getItem('apaar_copilot_feedback') || '[]');
      feedback.push({
        type,
        question,
        answer: answer.slice(0, 100),
        timestamp: new Date().toISOString(),
      });
      localStorage.setItem('apaar_copilot_feedback', JSON.stringify(feedback.slice(-50)));
    } catch (e) {
      // ignore
    }
  }
}

/**
 * Show Me Spotlight Navigation
 */
export function runSpotlight(tourId, targetHref) {
  if (targetHref) {
    window.location.hash = targetHref;
  }

  setTimeout(() => {
    let selector = '';
    switch (tourId) {
      case 'verify':
        selector = '[data-tour="verify-input"], #verifyCodeInput, .verify-action-card';
        break;
      case 'upload':
        selector = '[data-tour="upload-dropzone"], #dropZone, .upload-card';
        break;
      case 'institutions':
        selector = '[data-tour="institutions-table"], .data-table, .stats-card';
        break;
      case 'findings':
        selector = '[data-tour="findings-filter"], .btn-triage-tab, .data-table';
        break;
      case 'consent':
        selector = '[data-tour="consent-card"], .consent-item, .card';
        break;
      default:
        selector = `[data-tour="${tourId}"]`;
    }

    const target = document.querySelector(selector);
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      target.classList.add('spotlight-active');

      // Remove spotlight after 4 seconds
      setTimeout(() => {
        target.classList.remove('spotlight-active');
      }, 4000);
    }
  }, 400);
}

export const copilotDrawer = new CopilotDrawer();

export function openCopilot(query, context) {
  copilotDrawer.open(query, context);
}
