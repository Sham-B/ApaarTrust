/**
 * Idle and Page Visibility Manager
 * Prevents burning free server hours on sleeping hosts (e.g. SnapDeploy / Render).
 * - Blocks background API calls when tab is hidden or idle > 5 minutes
 * - Shows calm banner "Paused to save free server hours. Resume" after 10 minutes idle
 * - Provides clean hooks for wake-up probing and test instrumentation
 */

const IDLE_API_CUTOFF_MS = 5 * 60 * 1000; // 5 minutes
const IDLE_PAUSE_BANNER_MS = 10 * 60 * 1000; // 10 minutes

class IdleManager {
  constructor() {
    this.lastActivity = Date.now();
    this.paused = false;
    this.bannerEl = null;
    this.simulatedHidden = null;
    this.listenersAttached = false;
    this.checkTimer = null;
  }

  init() {
    if (this.listenersAttached) return;
    this.listenersAttached = true;

    // Track user activity
    const activityEvents = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click'];
    const onUserActivity = () => {
      if (!this.paused) {
        this.lastActivity = Date.now();
      }
    };

    activityEvents.forEach((evt) => {
      window.addEventListener(evt, onUserActivity, { passive: true });
    });

    // Page Visibility API
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        // Tab hidden: background calls immediately blocked
      } else {
        // Tab restored: if not paused, refresh activity
        if (!this.paused) {
          this.lastActivity = Date.now();
        }
      }
    });

    // Check ticker every 2.5 seconds (zero network requests, purely local)
    this.checkTimer = setInterval(() => {
      this.evaluateIdle();
    }, 2500);

    // Expose for instrumentation & tests
    window.__apaarIdle = this;
  }

  evaluateIdle() {
    if (this.paused) return;

    const idleMs = Date.now() - this.lastActivity;
    if (idleMs >= IDLE_PAUSE_BANNER_MS) {
      this.pause('inactivity_10m');
    }
  }

  isTabHidden() {
    if (typeof this.simulatedHidden === 'boolean') {
      return this.simulatedHidden;
    }
    return typeof document !== 'undefined' && document.hidden === true;
  }

  getIdleTimeMs() {
    return Date.now() - this.lastActivity;
  }

  isIdleForCalls() {
    return this.isTabHidden() || this.getIdleTimeMs() > IDLE_API_CUTOFF_MS || this.paused;
  }

  isRequestBlocked(options = {}) {
    // Wake-up probes and user-forced requests bypass idle guard
    if (options.isWakeProbe || options.force) {
      return false;
    }

    if (this.paused) return true;
    if (this.isTabHidden()) return true;
    if (this.getIdleTimeMs() > IDLE_API_CUTOFF_MS) return true;

    return false;
  }

  getBlockReason() {
    if (this.paused) return 'Paused to save free server hours';
    if (this.isTabHidden()) return 'Tab is hidden';
    if (this.getIdleTimeMs() > IDLE_API_CUTOFF_MS) return 'Client idle > 5 minutes';
    return '';
  }

  pause(reason = 'manual') {
    this.paused = true;
    this.showPauseBanner();
    window.dispatchEvent(new CustomEvent('apaar:idle-paused', { detail: { reason } }));
  }

  resume() {
    this.paused = false;
    this.lastActivity = Date.now();
    this.hidePauseBanner();
    window.dispatchEvent(new CustomEvent('apaar:idle-resumed'));
  }

  showPauseBanner() {
    if (this.bannerEl || typeof document === 'undefined') return;

    const banner = document.createElement('div');
    banner.id = 'idlePauseBanner';
    banner.className = 'idle-pause-banner';
    banner.setAttribute('role', 'alert');
    banner.innerHTML = `
      <span>Paused to save free server hours.</span>
      <button id="btnResumeIdle" class="btn-resume">Resume</button>
    `;

    document.body.appendChild(banner);
    this.bannerEl = banner;

    const resumeBtn = banner.querySelector('#btnResumeIdle');
    if (resumeBtn) {
      resumeBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.resume();
      });
    }
  }

  hidePauseBanner() {
    if (this.bannerEl && this.bannerEl.parentNode) {
      this.bannerEl.parentNode.removeChild(this.bannerEl);
    }
    this.bannerEl = null;
  }

  // Instrumentation for automated tests
  simulateIdle(ms) {
    this.lastActivity = Date.now() - ms;
    this.evaluateIdle();
  }

  setHidden(hidden) {
    this.simulatedHidden = Boolean(hidden);
    document.dispatchEvent(new Event('visibilitychange'));
  }
}

export const idleManager = new IdleManager();

