/**
 * AppShell Layout Component
 * Houses the Sidebar, Topbar, Breadcrumbs, and Main Content Container
 */

import { store } from '../store.js';
import { auth } from '../auth.js';
import { iconHtml } from './icons.js';

export function renderAppShell(arg1, arg2, arg3) {
  // Polymorphic support: renderAppShell(container, contentHtml, activeNavOrBreadcrumbs)
  if (arg1 && typeof arg1 === 'object' && arg1.nodeType === 1) {
    const container = arg1;
    const contentHtml = arg2;
    const navArg = arg3;
    const breadcrumbItems = Array.isArray(navArg)
      ? navArg
      : (typeof navArg === 'string'
          ? [{ label: navArg.charAt(0).toUpperCase() + navArg.slice(1), href: window.location.hash }]
          : []);
    const markup = getAppShellMarkup(contentHtml, breadcrumbItems);
    container.innerHTML = markup;
    bindAppShellEvents();
    return markup;
  }

  // Standard convention: renderAppShell(contentHtml, breadcrumbItems)
  const contentHtml = arg1;
  const breadcrumbItems = Array.isArray(arg2) ? arg2 : [];
  return getAppShellMarkup(contentHtml, breadcrumbItems);
}

export function getDefaultNav(role) {
  return auth.getDefaultNav(role);
}

export function getDefaultPersona(role, instId = null) {
  return auth.getDefaultPersona(role, instId);
}

function getAppShellMarkup(contentHtml, breadcrumbItems = []) {
  const safeBreadcrumbs = Array.isArray(breadcrumbItems) ? breadcrumbItems : [];
  const { role, persona, nav, theme, lang, notifications } = store.getState();

  const activePersona = persona || auth.getDefaultPersona(role);
  const roleTitle = role === 'Officer' ? 'AICTE Officer' : role === 'Institution' ? 'College Registrar' : role === 'Student' ? 'Student' : 'Public Verifier';
  const displayName = activePersona?.name || roleTitle;
  const displaySub = activePersona?.department || activePersona?.institution_name || activePersona?.apaar_masked || 'Open Access';
  const initials = activePersona?.initials || role?.slice(0, 2).toUpperCase() || 'AP';

  const currentHash = window.location.hash || auth.getRoleHome(role);
  const navItems = (Array.isArray(nav) && nav.length > 0) ? nav : auth.getDefaultNav(role);

  return `
    <div class="app-shell">
      <!-- Sidebar (Only displays allowed role navigation) -->
      <aside class="sidebar" id="appSidebar">
        <div class="sidebar-header">
          <a href="${auth.getRoleHome(role)}" class="sidebar-brand">
            <svg class="brand-logo-icon" aria-hidden="true"><use href="vendor/lucide-sprite.svg#icon-brand-logo"></use></svg>
            <span>ApaarTrust</span>
          </a>
          <span class="sidebar-role-badge">${role}</span>
        </div>

        <nav class="sidebar-nav-container" aria-label="Portal Navigation">
          <ul class="sidebar-nav-list">
            ${navItems
              .map((item) => {
                const isActive = currentHash.startsWith(item.href);
                return `
                <li class="sidebar-nav-item">
                  <a href="${item.href}" class="${isActive ? 'active' : ''}">
                    ${iconHtml(item.icon || 'arrow-right', 'icon-md')}
                    <span>${item.title}</span>
                  </a>
                </li>
              `;
              })
              .join('')}
          </ul>
        </nav>

        <div class="sidebar-footer">
          <div class="user-profile-widget">
            <div class="user-avatar-circle">${initials}</div>
            <div class="user-meta-info">
              <div class="user-display-name">${displayName}</div>
              <div class="user-display-sub">${displaySub}</div>
            </div>
            <button class="btn-switch-role btn-demo-role-switch" title="Switch demo role (Demo feature)">
              ${iconHtml('log-out', 'icon-sm')}
            </button>
          </div>
          <div style="font-size: 0.68rem; color: var(--text-subtle); margin-top: 6px; text-align: center;">
            Demo Mode · Synthetic Data
          </div>
        </div>
      </aside>

      <!-- Main Application Area -->
      <div class="app-main">
        <!-- Topbar -->
        <header class="topbar">
          <div class="topbar-left">
            <button class="mobile-menu-trigger" id="mobileMenuBtn" aria-label="Toggle Navigation Menu">
              ${iconHtml('sliders-horizontal', 'icon-md')}
            </button>

            <!-- Breadcrumbs -->
            <nav class="breadcrumbs" aria-label="Breadcrumb">
              <a href="${auth.getRoleHome(role)}">${roleTitle}</a>
              ${safeBreadcrumbs
                .map(
                  (bc, i) => `
                <span class="breadcrumbs-sep">/</span>
                ${i === safeBreadcrumbs.length - 1 ? `<span class="breadcrumbs-current">${bc.label}</span>` : `<a href="${bc.href}">${bc.label}</a>`}
              `
                )
                .join('')}
            </nav>
          </div>

          <div class="topbar-right">
            <!-- Command Palette Trigger -->
            <button class="cmd-palette-trigger" id="topbarCmdTrigger" title="Open command palette (Ctrl+K)">
              ${iconHtml('search', 'icon-sm')}
              <span>Search or command...</span>
              <kbd class="kbd-shortcut">Ctrl K</kbd>
            </button>

            <!-- Language Toggle (EN / HI / TA) -->
            <button class="btn-icon" id="langToggleBtn" title="Toggle English / Hindi / Tamil">
              <span style="font-weight: 700; font-size: 0.8rem;">${lang === 'en' ? 'हि' : lang === 'hi' ? 'த' : 'EN'}</span>
            </button>

            <!-- Theme Toggle -->
            <button class="btn-icon" id="themeToggleBtn" title="Toggle light/dark theme">
              ${iconHtml(theme === 'dark' ? 'sun' : 'moon', 'icon-md')}
            </button>

            <!-- Manual Refresh Button (user-triggered refresh) -->
            <button class="btn-icon" id="topbarRefreshBtn" title="Refresh view data">
              ${iconHtml('refresh-cw', 'icon-md')}
            </button>

            <!-- Notifications Bell -->
            <button class="btn-icon" id="notifBellBtn" title="Notifications" style="position: relative;">
              ${iconHtml('bell', 'icon-md')}
              ${notifications.unread_count > 0 ? `
                <span style="position: absolute; top: 4px; right: 4px; width: 8px; height: 8px; border-radius: 50%; background: var(--saffron);"></span>
              ` : ''}
            </button>

            <!-- AI Assistant Ask Trigger -->
            <button class="topbar-ask-btn" id="copilotHeaderBtn" title="Ask ApaarTrust AI Assistant (Ctrl+/)">
              ${iconHtml('sparkles', 'icon-sm')}
              <span>Ask ApaarTrust...</span>
              <kbd>Ctrl /</kbd>
            </button>
          </div>
        </header>

        <!-- Main Content Viewport -->
        <main class="content-area" id="mainContent">
          ${contentHtml}
        </main>
      </div>
    </div>
  `;
}

export function bindAppShellEvents() {
  // Mobile sidebar toggle
  const mobileBtn = document.getElementById('mobileMenuBtn');
  const sidebar = document.getElementById('appSidebar');
  if (mobileBtn && sidebar) {
    mobileBtn.addEventListener('click', () => {
      sidebar.classList.toggle('open');
    });
  }

  // Switch demo role
  const switchBtns = document.querySelectorAll('.btn-demo-role-switch');
  switchBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      auth.logoutToLanding();
    });
  });

  // Command palette
  const cmdBtn = document.getElementById('topbarCmdTrigger');
  if (cmdBtn) {
    cmdBtn.addEventListener('click', () => {
      window.dispatchEvent(new CustomEvent('apaar:open-palette'));
    });
  }

  // Language toggle
  const langBtn = document.getElementById('langToggleBtn');
  if (langBtn) {
    langBtn.addEventListener('click', () => {
      store.toggleLang();
    });
  }

  // Theme toggle
  const themeBtn = document.getElementById('themeToggleBtn');
  if (themeBtn) {
    themeBtn.addEventListener('click', () => {
      store.toggleTheme();
    });
  }

  // Copilot header trigger
  const copilotBtn = document.getElementById('copilotHeaderBtn');
  if (copilotBtn) {
    copilotBtn.addEventListener('click', () => {
      window.dispatchEvent(new CustomEvent('apaar:open-copilot'));
    });
  }

  // Manual refresh button
  const refreshBtn = document.getElementById('topbarRefreshBtn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', async () => {
      refreshBtn.style.transform = 'rotate(180deg)';
      refreshBtn.style.transition = 'transform 0.4s ease';
      try {
        await auth.refreshProfile();
        if (window.router && typeof window.router.handleRoute === 'function') {
          await window.router.handleRoute();
        }
      } finally {
        setTimeout(() => {
          refreshBtn.style.transform = 'none';
        }, 400);
      }
    });
  }

  // Notifications popup
  const notifBtn = document.getElementById('notifBellBtn');
  if (notifBtn) {
    notifBtn.addEventListener('click', () => {
      const { notifications } = store.getState();
      const items = notifications.items || [];
      const listHtml = items.length
        ? items
            .map(
              (n) => `
          <div style="padding: 10px 0; border-bottom: 1px solid var(--border-subtle);">
            <div style="font-weight: 600; font-size: 0.88rem;">${n.title}</div>
            <div style="font-size: 0.82rem; color: var(--text-muted);">${n.message}</div>
            <div style="font-size: 0.72rem; color: var(--text-subtle); margin-top: 2px;">${n.time}</div>
          </div>
        `
            )
            .join('')
        : '<p style="text-align: center; color: var(--text-muted); padding: 16px;">No unread notifications.</p>';

      import('./Modal.js').then(({ Modal }) => {
        const m = new Modal({
          title: 'Notifications',
          content: listHtml,
          footer: '<button class="btn btn-secondary btn-sm btn-close-notifs">Close</button>',
        });
        m.open();
        const closeB = m.backdrop.querySelector('.btn-close-notifs');
        if (closeB) closeB.addEventListener('click', () => m.close());
      });
    });
  }
}
