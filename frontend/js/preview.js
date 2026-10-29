/**
 * Preview Mode Manager
 * Allows browsing the application without a running backend server.
 * - Serves GET requests from recorded fixtures (frontend/fixtures/*.json)
 * - Blocks mutating actions with friendly toast: "Preview mode: start the live server to try this"
 * - Displays a persistent ribbon: "Preview mode: recorded sample data, not the live server"
 *   with a "Try the live server" button that restarts the wake-up flow.
 */

import { showToast } from './ui/Toast.js';
import { iconHtml } from './ui/icons.js';

class PreviewManager {
  constructor() {
    this.active = false;
    this.ribbonEl = null;
    try {
      this.active = sessionStorage.getItem('apaar_preview_mode') === 'true';
    } catch (e) {
      this.active = false;
    }
  }

  init() {
    if (this.active) {
      this.renderRibbon();
    }
    window.__apaarPreview = this;
  }

  isActive() {
    return this.active;
  }

  enable() {
    this.active = true;
    try {
      sessionStorage.setItem('apaar_preview_mode', 'true');
    } catch (e) {}

    this.renderRibbon();

    showToast({
      type: 'info',
      message: 'Preview mode: browsing recorded sample data without server.',
    });

    window.dispatchEvent(new CustomEvent('apaar:preview-changed', { detail: { active: true } }));

    if (window.router && typeof window.router.handleRoute === 'function') {
      window.router.handleRoute();
    }
  }

  disable() {
    this.active = false;
    try {
      sessionStorage.removeItem('apaar_preview_mode');
    } catch (e) {}

    this.removeRibbon();

    window.dispatchEvent(new CustomEvent('apaar:preview-changed', { detail: { active: false } }));

    if (window.router && typeof window.router.handleRoute === 'function') {
      window.router.handleRoute();
    }
  }

  renderRibbon() {
    if (this.ribbonEl || typeof document === 'undefined') return;

    const ribbon = document.createElement('div');
    ribbon.id = 'previewModeRibbon';
    ribbon.className = 'preview-mode-ribbon';
    ribbon.setAttribute('role', 'status');
    ribbon.innerHTML = `
      <div style="display: flex; align-items: center; gap: 8px;">
        ${iconHtml('database', 'icon-xs')}
        <span>Preview mode: recorded sample data, not the live server</span>
      </div>
      <button id="btnTryLiveServer" class="btn-try-live">
        ${iconHtml('zap', 'icon-xs')} Try the live server
      </button>
    `;

    document.body.prepend(ribbon);
    this.ribbonEl = ribbon;

    const tryBtn = ribbon.querySelector('#btnTryLiveServer');
    if (tryBtn) {
      tryBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        const { wakeupManager } = await import('./wakeup.js');
        wakeupManager.startWakeupFlow();
      });
    }
  }

  removeRibbon() {
    if (this.ribbonEl && this.ribbonEl.parentNode) {
      this.ribbonEl.parentNode.removeChild(this.ribbonEl);
    }
    this.ribbonEl = null;
  }

  notifyMutationBlocked() {
    window.dispatchEvent(
      new CustomEvent('apaar:toast', {
        detail: {
          type: 'warning',
          message: 'Preview mode: start the live server to try this',
        },
      })
    );
    showToast({
      type: 'warning',
      message: 'Preview mode: start the live server to try this',
    });
  }
}

export const previewManager = new PreviewManager();
