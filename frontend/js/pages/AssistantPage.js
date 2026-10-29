/**
 * Dedicated Full-Page Assistant View (#/assistant)
 * Offline rule-grounded AI Compliance Assistant
 */

import { store } from '../store.js';
import { api } from '../api.js';
import { previewManager } from '../preview.js';
import { queryKnowledgeBaseClientSide } from '../fixtures.js';
import { renderAppShell, bindAppShellEvents } from '../ui/AppShell.js';
import { iconHtml } from '../ui/icons.js';
import { renderMarkdownLite, runSpotlight } from '../ui/CopilotDrawer.js';

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export async function renderAssistantPage(container) {
  const { role, studentToken, institutionId } = store.getState();

  const getRoleSuggestions = (r) => {
    switch (r) {
      case 'Officer':
        return [
          'Which institutions are over intake?',
          'Explain this finding',
          'Why was this duplicate flagged?',
          'How many open findings do I have?',
          'What is the validation rule for NRI and OCI admissions?',
          'How does ApaarTrust handle cross-institution duplicate enrolments?',
        ];
      case 'Institution':
        return [
          'How do I fix my file?',
          'What does dry run mean?',
          'What is the maximum approved intake for CSE?',
          'How many students are enrolled?',
          'What are the supernumerary quota limits for TFW and EWS?',
          'What are the approved seat rules for Computer Science?',
        ];
      case 'Student':
        return [
          'Who can see my data?',
          'How do I revoke consent?',
          'What is SD-JWT-inspired selective disclosure?',
          'Who viewed my record?',
          'How many active consents do I have?',
          'What happens if I revoke consent for a verifier?',
        ];
      default:
        return [
          'How does verification work?',
          'What does tampered status mean?',
          'What is the difference between genuine and revoked?',
          'How is student privacy protected?',
          'What is an SD-JWT credential?',
          'Who is authorized to take an adverse regulatory action on a submission?',
        ];
    }
  };

  const suggestions = getRoleSuggestions(role);

  // Load chat history from localStorage
  let chatHistory = [];
  try {
    chatHistory = JSON.parse(localStorage.getItem('apaar_copilot_history') || '[]');
  } catch (e) {
    chatHistory = [];
  }

  const chatContentHtml = `
    <div class="assistant-fullpage-container">
      <!-- Title & Disclaimer Bar -->
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: var(--space-4);">
        <div>
          <div style="display: flex; align-items: center; gap: 8px;">
            <h1 style="font-size: 1.5rem; font-weight: 700; margin: 0;">Ask ApaarTrust AI Assistant</h1>
            <span class="badge" style="background: var(--navy-800); color: var(--saffron);">
              ${role || 'Public'} Persona
            </span>
          </div>
          <p style="color: var(--text-muted); font-size: 0.88rem; margin: 4px 0 0 0;">
            Strictly rule-grounded offline compliance assistant. Answers are verified against local YAML rules and the glossary.
          </p>
        </div>
        <div style="display: flex; gap: 8px;">
          <button class="btn btn-secondary btn-sm" id="btnAssistantClearChat">
            ${iconHtml('trash-2', 'icon-sm')} Clear Chat
          </button>
        </div>
      </div>

      <!-- Quick Topic Chips -->
      <div style="margin-bottom: var(--space-3);">
        <div style="font-size: 0.78rem; font-weight: 600; color: var(--text-muted); margin-bottom: 6px;">Suggested Inquiries for ${role || 'Public'} View:</div>
        <div class="copilot-chip-list">
          ${suggestions.map((q) => `<button class="copilot-chip btn-assistant-page-chip" data-q="${escapeHtml(q)}">${escapeHtml(q)}</button>`).join('')}
        </div>
      </div>

      <!-- Message History Viewport -->
      <div class="assistant-fullpage-chat" id="assistantFullChat">
        ${
          chatHistory.length === 0
            ? `
          <div style="text-align: center; color: var(--text-muted); padding: 48px 20px;">
            <div style="color: var(--saffron); margin-bottom: 12px;">${iconHtml('sparkles', 'icon-xl')}</div>
            <h3 style="font-size: 1.1rem; font-weight: 600; margin-bottom: 6px;">How can ApaarTrust assist you today?</h3>
            <p style="font-size: 0.88rem; max-width: 500px; margin: 0 auto; color: var(--text-subtle);">
              Click any question chip above or enter an inquiry below to inspect regulatory norms, intake limits, or verification integrity.
            </p>
          </div>
        `
            : ''
        }
      </div>

      <!-- Input Form -->
      <div style="background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: var(--radius-lg); padding: var(--space-3);">
        <form id="assistantFullForm" style="display: flex; gap: var(--space-2);">
          <input
            type="text"
            id="assistantFullInput"
            class="form-input"
            style="flex: 1;"
            placeholder="Ask about validation rules, seat caps, duplicate adjudication, or privacy..."
            required
            autocomplete="off"
          />
          <button type="submit" class="btn btn-primary" id="assistantFullSubmitBtn">
            ${iconHtml('arrow-right', 'icon-sm')} Ask
          </button>
        </form>
        <div style="font-size: 0.72rem; color: var(--text-subtle); margin-top: 8px; text-align: center;">
          Demo assistant. Not legal or regulatory advice. Grounded strictly in configured YAML rules.
        </div>
      </div>
    </div>
  `;

  if (role) {
    container.innerHTML = renderAppShell(chatContentHtml, [{ label: 'AI Assistant', href: '#/assistant' }]);
    bindAppShellEvents();
  } else {
    // Standalone public header
    container.innerHTML = `
      <header style="background: var(--bg-surface); border-bottom: 1px solid var(--border-color); position: sticky; top: 0; z-index: 100;">
        <div style="max-width: 1100px; margin: 0 auto; padding: 14px 20px; display: flex; justify-content: space-between; align-items: center;">
          <a href="#/" style="display: flex; align-items: center; gap: 10px; text-decoration: none; color: inherit;">
            <div style="width: 32px; height: 32px; border-radius: 8px; background: var(--primary); display: flex; align-items: center; justify-content: center; color: white;">
              ${iconHtml('shield-check', 'icon-md')}
            </div>
            <span style="font-size: 18px; font-weight: 700; color: var(--primary);">ApaarTrust</span>
            <span class="badge" style="background: rgba(20, 48, 122, 0.08); color: var(--primary);">AI Assistant</span>
          </a>
          <a href="#/" class="btn btn-ghost btn-sm">
            ${iconHtml('arrow-left', 'icon-sm')} Back to Home
          </a>
        </div>
      </header>
      <main style="max-width: 960px; margin: 24px auto; padding: 0 20px;">
        ${chatContentHtml}
      </main>
    `;
  }

  const chatContainer = document.getElementById('assistantFullChat');
  const form = document.getElementById('assistantFullForm');
  const input = document.getElementById('assistantFullInput');
  const clearBtn = document.getElementById('btnAssistantClearChat');

  function renderMessages() {
    if (!chatHistory.length) {
      chatContainer.innerHTML = `
        <div style="text-align: center; color: var(--text-muted); padding: 48px 20px;">
          <div style="color: var(--saffron); margin-bottom: 12px;">${iconHtml('sparkles', 'icon-xl')}</div>
          <h3 style="font-size: 1.1rem; font-weight: 600; margin-bottom: 6px;">How can ApaarTrust assist you today?</h3>
          <p style="font-size: 0.88rem; max-width: 500px; margin: 0 auto; color: var(--text-subtle);">
            Click any question chip above or enter an inquiry below to inspect regulatory norms, intake limits, or verification integrity.
          </p>
        </div>
      `;
      return;
    }

    chatContainer.innerHTML = chatHistory
      .map((item, idx) => {
        if (item.role === 'user') {
          return `
            <div class="copilot-message user">
              <div style="font-weight: 600; font-size: 0.75rem; color: var(--text-muted); margin-bottom: 2px;">You</div>
              <div>${escapeHtml(item.text)}</div>
            </div>
          `;
        }

        const textVal = item.text || item.message || item.answer || '';
        const formattedHtml = renderMarkdownLite(textVal);

        // Detect action suggestions
        const lowerText = textVal.toLowerCase();
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

        let actionsHtml = '';
        if (actionItems.length > 0) {
          actionsHtml = `
            <div style="display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px;">
              ${actionItems
                .map(
                  (act) => `
                <button class="btn btn-secondary btn-xs btn-page-action" data-tour="${act.tour}" data-href="${act.href}">
                  ${iconHtml('compass', 'icon-xs')} ${act.label}
                </button>
              `
                )
                .join('')}
            </div>
          `;
        }

        let suggestionsHtml = '';
        if (item.suggestions && item.suggestions.length > 0) {
          suggestionsHtml = `
            <div style="margin-top: 8px;">
              <div style="font-size: 0.72rem; color: var(--text-subtle); margin-bottom: 4px;">Follow-up questions:</div>
              <div class="copilot-chip-list" style="margin-bottom: 0;">
                ${item.suggestions
                  .map((s) => `<button class="copilot-chip btn-page-followup" data-q="${escapeHtml(s)}">${escapeHtml(s)}</button>`)
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

            <div class="copilot-actions">
              <button class="copilot-action-btn btn-copy-page-msg" title="Copy answer to clipboard">
                ${iconHtml('copy', 'icon-xs')} <span>Copy</span>
              </button>
              <button class="copilot-action-btn btn-page-thumb-up" title="Helpful answer">
                ${iconHtml('thumbs-up', 'icon-xs')}
              </button>
              <button class="copilot-action-btn btn-page-thumb-down" title="Not helpful">
                ${iconHtml('thumbs-down', 'icon-xs')}
              </button>
            </div>
          </div>
        `;
      })
      .join('');

    chatContainer.scrollTop = chatContainer.scrollHeight;
    bindChatInteractions();
  }

  function bindChatInteractions() {
    // Copy buttons
    chatContainer.querySelectorAll('.btn-copy-page-msg').forEach((btn) => {
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

    // Thumbs
    chatContainer.querySelectorAll('.btn-page-thumb-up').forEach((btn) => {
      btn.addEventListener('click', () => {
        btn.classList.toggle('voted-up');
        const sibling = btn.parentElement.querySelector('.btn-page-thumb-down');
        if (sibling) sibling.classList.remove('voted-down');
        saveFeedback(btn, 'up');
      });
    });

    chatContainer.querySelectorAll('.btn-page-thumb-down').forEach((btn) => {
      btn.addEventListener('click', () => {
        btn.classList.toggle('voted-down');
        const sibling = btn.parentElement.querySelector('.btn-page-thumb-up');
        if (sibling) sibling.classList.remove('voted-up');
        saveFeedback(btn, 'down');
      });
    });

    // Action tour buttons
    chatContainer.querySelectorAll('.btn-page-action').forEach((btn) => {
      btn.addEventListener('click', () => {
        const tour = btn.dataset.tour;
        const href = btn.dataset.href;
        runSpotlight(tour, href);
      });
    });

    // Follow-ups
    chatContainer.querySelectorAll('.btn-page-followup').forEach((btn) => {
      btn.addEventListener('click', () => {
        const q = btn.dataset.q;
        handleUserQuery(q);
      });
    });
  }

  function saveFeedback(btn, type) {
    try {
      const msgEl = btn.closest('.copilot-message');
      const idx = msgEl ? msgEl.dataset.msgIdx : null;
      const question = idx && chatHistory[idx - 1] ? chatHistory[idx - 1].text : '';
      const answer = idx && chatHistory[idx] ? chatHistory[idx].text : '';

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

  async function handleUserQuery(question) {
    chatHistory.push({ role: 'user', text: question });
    try {
      localStorage.setItem('apaar_copilot_history', JSON.stringify(chatHistory.slice(-30)));
    } catch (e) {}
    renderMessages();

    // Show typing state
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
    chatContainer.appendChild(typingEl);
    chatContainer.scrollTop = chatContainer.scrollHeight;

    try {
      let response;
      if (previewManager.isActive()) {
        const kbResult = queryKnowledgeBaseClientSide(question, role);
        response = {
          answer: kbResult.answer,
          rule_source: kbResult.found ? (kbResult.rule_source || 'knowledge_base.yaml') : null,
          engine: kbResult.found ? 'client-side preview knowledge index' : 'preview mode',
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
          current_page: '#/assistant',
          student_token: studentToken,
          institution_id: institutionId,
        });
      }

      if (typingEl.parentElement) chatContainer.removeChild(typingEl);

      chatHistory.push({
        role: 'assistant',
        text: response.answer,
        ruleSource: response.rule_source,
        modelLabel: response.engine || 'template explanation',
        actions: response.actions || [],
        suggestions: response.suggestions || [],
      });
      try {
        localStorage.setItem('apaar_copilot_history', JSON.stringify(chatHistory.slice(-30)));
      } catch (e) {}
      renderMessages();
    } catch (err) {
      if (typingEl.parentElement) chatContainer.removeChild(typingEl);
      const kbResult = queryKnowledgeBaseClientSide(question, role);
      chatHistory.push({
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
      try {
        localStorage.setItem('apaar_copilot_history', JSON.stringify(chatHistory.slice(-30)));
      } catch (e) {}
      renderMessages();
    }
  }

  // Bind chips at top
  const chipBtns = container.querySelectorAll('.btn-assistant-page-chip');
  chipBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const q = btn.dataset.q;
      handleUserQuery(q);
    });
  });

  // Form submit
  if (form && input) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const val = input.value.trim();
      if (val) {
        input.value = '';
        handleUserQuery(val);
      }
    });
  }

  // Clear chat
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      chatHistory = [];
      try {
        localStorage.removeItem('apaar_copilot_history');
      } catch (e) {}
      renderMessages();
    });
  }

  // Initial render
  renderMessages();
}
