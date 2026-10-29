/**
 * Accessible Modal Window Component
 */

import { iconHtml } from './icons.js';

export class Modal {
  constructor(options = {}) {
    this.title = options.title || '';
    this.content = options.content || options.bodyHtml || '';
    this.footer = options.footer || '';
    this.onClose = options.onClose || null;
    this.backdrop = null;
    this.init();
  }

  init() {
    this.backdrop = document.createElement('div');
    this.backdrop.className = 'modal-backdrop';
    this.backdrop.setAttribute('role', 'dialog');
    this.backdrop.setAttribute('aria-modal', 'true');

    this.backdrop.innerHTML = `
      <div class="modal-window">
        <div class="modal-header">
          <h3>${this.title}</h3>
          <button class="btn-icon btn-modal-close" aria-label="Close modal">
            ${iconHtml('x', 'icon-sm')}
          </button>
        </div>
        <div class="modal-body">${this.content}</div>
        ${this.footer ? `<div class="modal-footer">${this.footer}</div>` : ''}
      </div>
    `;

    // Close handlers
    const closeBtn = this.backdrop.querySelector('.btn-modal-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.close());
    }

    this.backdrop.addEventListener('click', (e) => {
      if (e.target === this.backdrop) {
        this.close();
      }
    });

    this.handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        this.close();
      }
    };

    document.body.appendChild(this.backdrop);
  }

  open() {
    document.addEventListener('keydown', this.handleKeyDown);
    // Trigger transition
    requestAnimationFrame(() => {
      this.backdrop.classList.add('open');
    });
  }

  close() {
    document.removeEventListener('keydown', this.handleKeyDown);
    this.backdrop.classList.remove('open');
    if (this.onClose) this.onClose();
    setTimeout(() => {
      if (this.backdrop && this.backdrop.parentElement) {
        this.backdrop.parentElement.removeChild(this.backdrop);
      }
    }, 200);
  }

  setContent(newHtml) {
    const body = this.backdrop.querySelector('.modal-body');
    if (body) body.innerHTML = newHtml;
  }
}

export function openModal(options = {}) {
  let footerHtml = options.footer || '';
  if (!footerHtml && Array.isArray(options.actions)) {
    footerHtml = `
      <div style="display: flex; gap: 8px; justify-content: flex-end; width: 100%;">
        ${options.actions.map((act, i) => `
          <button class="btn btn-${act.variant || 'secondary'} btn-sm btn-modal-act-${i}">
            ${act.label}
          </button>
        `).join('')}
      </div>
    `;
  }

  const m = new Modal({
    title: options.title,
    content: options.bodyHtml || options.content,
    footer: footerHtml,
    onClose: options.onClose
  });

  m.open();

  if (Array.isArray(options.actions)) {
    options.actions.forEach((act, i) => {
      const btn = m.backdrop.querySelector(`.btn-modal-act-${i}`);
      if (btn && typeof act.onClick === 'function') {
        btn.addEventListener('click', () => act.onClick(() => m.close()));
      }
    });
  }

  return m;
}

export const renderModal = openModal;
