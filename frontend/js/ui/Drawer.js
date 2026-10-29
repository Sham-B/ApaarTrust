/**
 * Accessible Drawer Component (Slide-in from right)
 */

import { iconHtml } from './icons.js';

export class Drawer {
  constructor(options = {}) {
    this.title = options.title || '';
    this.content = options.content || '';
    this.onClose = options.onClose || null;
    this.width = options.width || '520px';
    this.backdrop = null;
    this.init();
  }

  init() {
    this.backdrop = document.createElement('div');
    this.backdrop.className = 'drawer-backdrop';
    this.backdrop.setAttribute('role', 'dialog');
    this.backdrop.setAttribute('aria-modal', 'true');

    this.backdrop.innerHTML = `
      <div class="drawer-window" style="width: ${this.width};">
        <div class="drawer-header">
          <h3>${this.title}</h3>
          <button class="btn-icon btn-drawer-close" aria-label="Close drawer">
            ${iconHtml('x', 'icon-sm')}
          </button>
        </div>
        <div class="drawer-body">${this.content}</div>
      </div>
    `;

    const closeBtn = this.backdrop.querySelector('.btn-drawer-close');
    closeBtn.addEventListener('click', () => this.close());

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
    const body = this.backdrop.querySelector('.drawer-body');
    if (body) body.innerHTML = newHtml;
  }
}
