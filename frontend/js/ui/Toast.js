/**
 * Toast Notification Component
 */

import { iconHtml } from './icons.js';

export class ToastManager {
  constructor() {
    this.container = null;
    this.init();
  }

  init() {
    if (typeof document === 'undefined') return;
    if (!this.container) {
      this.container = document.createElement('div');
      this.container.className = 'toast-container';
      this.container.setAttribute('aria-live', 'polite');
    }
    if (document.body && !this.container.parentElement) {
      document.body.appendChild(this.container);
    }

    window.addEventListener('apaar:toast', (e) => {
      const { type = 'info', message = '', duration = 4000 } = e.detail || {};
      this.show(message, type, duration);
    });
  }

  show(message, type = 'info', duration = 4000, options = {}) {
    if (typeof document === 'undefined') return;
    if (!this.container || !this.container.parentElement) {
      if (!this.container) {
        this.container = document.createElement('div');
        this.container.className = 'toast-container';
        this.container.setAttribute('aria-live', 'polite');
      }
      if (document.body) {
        document.body.appendChild(this.container);
      }
    }
    if (!this.container) return;
    const toastEl = document.createElement('div');
    toastEl.className = `toast toast-${type}`;

    let iconName = 'info';
    if (type === 'success') iconName = 'check-circle-2';
    if (type === 'warning') iconName = 'alert-triangle';
    if (type === 'error') iconName = 'alert-circle';

    const actionHtml = options.actionText
      ? `<button class="btn btn-secondary btn-xs btn-toast-action" style="margin-left: 8px; font-weight: 600;">${options.actionText}</button>`
      : '';

    toastEl.innerHTML = `
      ${iconHtml(iconName, 'icon-md')}
      <div style="flex: 1; min-width: 0;">${message}</div>
      ${actionHtml}
      <button class="btn-icon btn-toast-close" aria-label="Close notification" style="padding: 2px;">
        ${iconHtml('x', 'icon-sm')}
      </button>
    `;

    const closeBtn = toastEl.querySelector('.btn-toast-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.dismiss(toastEl));
    }

    const actionBtn = toastEl.querySelector('.btn-toast-action');
    if (actionBtn && typeof options.onAction === 'function') {
      actionBtn.addEventListener('click', () => {
        options.onAction();
        this.dismiss(toastEl);
      });
    }

    this.container.appendChild(toastEl);

    if (duration > 0) {
      setTimeout(() => this.dismiss(toastEl), duration);
    }
  }

  dismiss(toastEl) {
    toastEl.style.transition = 'opacity 150ms ease, transform 150ms ease';
    toastEl.style.opacity = '0';
    toastEl.style.transform = 'translateY(10px)';
    setTimeout(() => {
      if (toastEl.parentElement) {
        toastEl.parentElement.removeChild(toastEl);
      }
    }, 160);
  }
}

export const toast = new ToastManager();

export function showToast(optsOrMsg, maybeType = 'info', duration = 4000) {
  if (typeof optsOrMsg === 'object' && optsOrMsg !== null) {
    toast.show(optsOrMsg.message || optsOrMsg.text || '', optsOrMsg.type || 'info', optsOrMsg.duration || 4000);
  } else {
    toast.show(String(optsOrMsg || ''), maybeType, duration);
  }
}
