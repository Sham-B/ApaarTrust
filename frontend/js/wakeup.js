/**
 * Wake-Up Probe Manager
 * Handles waking up sleeping free-tier hosts (e.g. SnapDeploy, Render).
 * - Probes /health every 2.5 seconds with { isWakeProbe: true }
 * - Offers "View preview without server" after 15 seconds
 * - Stops probing after 5 minutes with a "Try again" button
 */

import { api } from './api.js';
import { previewManager } from './preview.js';
import { showToast } from './ui/Toast.js';
import { iconHtml } from './ui/icons.js';

const PROBE_INTERVAL_MS = 2500;
const PREVIEW_OFFER_MS = 15 * 1000; // 15 seconds
const PROBE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

class WakeupManager {
  constructor() {
    this.probing = false;
    this.probeStartTime = 0;
    this.timerId = null;
    this.tickerId = null;
    this.modalEl = null;
    this.onSuccessCallback = null;
  }

  startWakeupFlow(options = {}) {
    if (this.probing) return;
    this.probing = true;
    this.probeStartTime = Date.now();
    this.onSuccessCallback = options.onSuccess || null;

    this.renderModal();
    this.probeOnce();

    this.timerId = setInterval(() => {
      this.probeOnce();
    }, PROBE_INTERVAL_MS);

    this.tickerId = setInterval(() => {
      this.updateTicker();
    }, 1000);
  }

  stopProbing() {
    this.probing = false;
    if (this.timerId) clearInterval(this.timerId);
    if (this.tickerId) clearInterval(this.tickerId);
    this.timerId = null;
    this.tickerId = null;
  }

  async probeOnce() {
    if (!this.probing) return;

    const elapsed = Date.now() - this.probeStartTime;
    if (elapsed >= PROBE_TIMEOUT_MS) {
      this.stopProbing();
      this.renderTimedOutState();
      return;
    }

    try {
      const res = await api.get('/health', { isWakeProbe: true, timeout: 4000 });
      if (res && (res.ready === true || res.status === 'ok' || res.demo_mode !== undefined)) {
        this.handleWakeSuccess();
      }
    } catch (err) {
      // Backend still sleeping or spinning up, ignore and continue probing
    }
  }

  updateTicker() {
    if (!this.modalEl || !this.probing) return;

    const elapsedMs = Date.now() - this.probeStartTime;
    const elapsedSec = Math.floor(elapsedMs / 1000);

    const timerEl = this.modalEl.querySelector('#wakeupTimerText');
    if (timerEl) {
      const mins = Math.floor(elapsedSec / 60);
      const secs = (elapsedSec % 60).toString().padStart(2, '0');
      timerEl.textContent = `${mins}:${secs}`;
    }

    // Show preview button after 15 seconds
    if (elapsedMs >= PREVIEW_OFFER_MS) {
      const previewBtn = this.modalEl.querySelector('#btnWakeupPreview');
      if (previewBtn && previewBtn.style.display === 'none') {
        previewBtn.style.display = 'inline-flex';
      }
    }
  }

  handleWakeSuccess() {
    this.stopProbing();
    this.closeModal();

    if (previewManager.isActive()) {
      previewManager.disable();
    }

    showToast({
      type: 'success',
      message: 'Server is awake! Connected to live backend.',
    });

    window.dispatchEvent(new CustomEvent('apaar:server-ready'));

    if (typeof this.onSuccessCallback === 'function') {
      this.onSuccessCallback();
    } else {
      // Reload current view
      if (window.router && typeof window.router.handleRoute === 'function') {
        window.router.handleRoute();
      }
    }
  }

  renderModal() {
    this.closeModal();

    const backdrop = document.createElement('div');
    backdrop.id = 'wakeupModalBackdrop';
    backdrop.className = 'modal-backdrop';
    backdrop.style.zIndex = '99999';

    backdrop.innerHTML = `
      <div class="modal-dialog" style="max-width: 480px; text-align: center; padding: var(--space-6);">
        <div style="width: 56px; height: 56px; border-radius: 50%; background: rgba(232, 115, 26, 0.12); color: var(--saffron); display: flex; align-items: center; justify-content: center; margin: 0 auto var(--space-4);">
          <span class="spinner" style="width: 28px; height: 28px; border-width: 3px;"></span>
        </div>

        <h2 style="font-size: 1.35rem; margin-bottom: var(--space-2);">Waking up the server...</h2>
        <p style="font-size: 0.9rem; color: var(--text-muted); line-height: 1.5; margin-bottom: var(--space-4);">
          ApaarTrust runs on a free container host that sleeps when idle to preserve server hours. Spin-up typically takes about 30–60 seconds.
        </p>

        <div style="background: var(--bg-subtle); padding: 12px; border-radius: var(--radius-md); font-size: 0.84rem; color: var(--text-main); margin-bottom: var(--space-5);">
          Elapsed: <strong id="wakeupTimerText" style="font-family: var(--font-mono);">0:00</strong> / 5:00 max
        </div>

        <div id="wakeupModalActions" style="display: flex; gap: 10px; justify-content: center; flex-wrap: wrap;">
          <button id="btnWakeupPreview" class="btn btn-secondary btn-sm" style="display: none;">
            ${iconHtml('eye', 'icon-sm')} View preview without server
          </button>
          <button id="btnWakeupCancel" class="btn btn-ghost btn-sm">
            Cancel
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(backdrop);
    this.modalEl = backdrop;

    const cancelBtn = backdrop.querySelector('#btnWakeupCancel');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => {
        this.stopProbing();
        this.closeModal();
      });
    }

    const previewBtn = backdrop.querySelector('#btnWakeupPreview');
    if (previewBtn) {
      previewBtn.addEventListener('click', () => {
        this.stopProbing();
        this.closeModal();
        previewManager.enable();
      });
    }
  }

  renderTimedOutState() {
    if (!this.modalEl) return;

    const dialog = this.modalEl.querySelector('.modal-dialog');
    if (!dialog) return;

    dialog.innerHTML = `
      <div style="width: 56px; height: 56px; border-radius: 50%; background: rgba(239, 68, 68, 0.12); color: #ef4444; display: flex; align-items: center; justify-content: center; margin: 0 auto var(--space-4);">
        ${iconHtml('alert-triangle', 'icon-lg')}
      </div>

      <h2 style="font-size: 1.35rem; margin-bottom: var(--space-2);">Server did not respond</h2>
      <p style="font-size: 0.9rem; color: var(--text-muted); line-height: 1.5; margin-bottom: var(--space-5);">
        Wake-up probing stopped after 5 minutes. The host may still be booting or experiencing network limits. You can try again or use the full no-server preview.
      </p>

      <div style="display: flex; gap: 10px; justify-content: center; flex-wrap: wrap;">
        <button id="btnWakeupTryAgain" class="btn btn-primary btn-sm">
          ${iconHtml('refresh-cw', 'icon-sm')} Try again
        </button>
        <button id="btnWakeupPreviewTimedOut" class="btn btn-secondary btn-sm">
          ${iconHtml('eye', 'icon-sm')} View preview without server
        </button>
        <button id="btnWakeupClose" class="btn btn-ghost btn-sm">
          Close
        </button>
      </div>
    `;

    const tryAgainBtn = dialog.querySelector('#btnWakeupTryAgain');
    if (tryAgainBtn) {
      tryAgainBtn.addEventListener('click', () => {
        this.startWakeupFlow({ onSuccess: this.onSuccessCallback });
      });
    }

    const previewBtn = dialog.querySelector('#btnWakeupPreviewTimedOut');
    if (previewBtn) {
      previewBtn.addEventListener('click', () => {
        this.closeModal();
        previewManager.enable();
      });
    }

    const closeBtn = dialog.querySelector('#btnWakeupClose');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        this.closeModal();
      });
    }
  }

  closeModal() {
    if (this.modalEl && this.modalEl.parentNode) {
      this.modalEl.parentNode.removeChild(this.modalEl);
    }
    this.modalEl = null;
  }
}

export const wakeupManager = new WakeupManager();

