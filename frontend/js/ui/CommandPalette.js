/**
 * Linear-style Command Palette (Ctrl/Cmd+K)
 * Scoped to active role's navigation and actions
 */

import { store } from '../store.js';
import { iconHtml } from './icons.js';

export class CommandPalette {
  constructor() {
    this.backdrop = null;
    this.isOpen = false;
    this.searchQuery = '';
    this.selectedIndex = 0;
    this.init();
  }

  init() {
    // Keyboard shortcut listeners
    window.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        this.toggle();
      } else if (e.key === '?' && !['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('apaar:open-shortcuts'));
      }
    });

    window.addEventListener('apaar:open-palette', () => this.open());
  }

  getItems() {
    const { role, nav } = store.getState();
    const items = [];

    // Navigation links from role
    nav.forEach((n) => {
      items.push({
        type: 'Navigation',
        title: `Go to ${n.title}`,
        icon: n.icon || 'arrow-right',
        action: () => {
          window.location.hash = n.href;
          this.close();
        },
      });
    });

    // Theme toggle action
    items.push({
      type: 'Preferences',
      title: 'Toggle light / dark theme',
      icon: 'sun',
      action: () => {
        store.toggleTheme();
        this.close();
      },
    });

    // Language toggle action
    items.push({
      type: 'Preferences',
      title: 'Switch language (English / Hindi)',
      icon: 'sparkles',
      action: () => {
        store.toggleLang();
        this.close();
      },
    });

    // Role-specific actions
    if (role === 'Officer') {
      items.push({
        type: 'Actions',
        title: 'Run data fraud drill',
        icon: 'zap',
        action: () => {
          window.location.hash = '#/officer/insights';
          this.close();
        },
      });
      items.push({
        type: 'Actions',
        title: 'Verify cryptographic audit chain',
        icon: 'history',
        action: () => {
          window.location.hash = '#/officer/audit';
          this.close();
        },
      });
    } else if (role === 'Institution') {
      items.push({
        type: 'Actions',
        title: 'Upload student intake file (Dry run)',
        icon: 'upload-cloud',
        action: () => {
          window.location.hash = '#/college/upload';
          this.close();
        },
      });
      items.push({
        type: 'Actions',
        title: 'Download intake template (Excel/CSV)',
        icon: 'download',
        action: () => {
          window.location.hash = '#/college/upload';
          this.close();
        },
      });
    } else if (role === 'Student') {
      items.push({
        type: 'Actions',
        title: 'Manage verification consent grants',
        icon: 'lock',
        action: () => {
          window.location.hash = '#/student/consent';
          this.close();
        },
      });
      items.push({
        type: 'Actions',
        title: 'View certificate and QR presentation',
        icon: 'award',
        action: () => {
          window.location.hash = '#/student/certificates';
          this.close();
        },
      });
    }

    // Switch demo role action
    items.push({
      type: 'System',
      title: 'Switch demo role (Return to front door)',
      icon: 'users',
      action: () => {
        store.clearRole();
        window.location.hash = '#/';
        this.close();
      },
    });

    // Filter by query
    if (this.searchQuery.trim()) {
      const q = this.searchQuery.toLowerCase();
      return items.filter((i) => i.title.toLowerCase().includes(q) || i.type.toLowerCase().includes(q));
    }

    return items;
  }

  toggle() {
    if (this.isOpen) this.close();
    else this.open();
  }

  open() {
    this.isOpen = true;
    this.searchQuery = '';
    this.selectedIndex = 0;

    this.backdrop = document.createElement('div');
    this.backdrop.className = 'modal-backdrop open';
    this.backdrop.style.zIndex = '200';

    this.backdrop.innerHTML = `
      <div class="cmd-palette-box">
        <input type="text" class="cmd-palette-input" placeholder="Type a command or search..." autofocus />
        <div class="cmd-palette-results"></div>
      </div>
    `;

    document.body.appendChild(this.backdrop);

    const input = this.backdrop.querySelector('.cmd-palette-input');
    input.focus();

    input.addEventListener('input', (e) => {
      this.searchQuery = e.target.value;
      this.selectedIndex = 0;
      this.renderResults();
    });

    input.addEventListener('keydown', (e) => {
      const items = this.getItems();
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        this.selectedIndex = (this.selectedIndex + 1) % (items.length || 1);
        this.renderResults();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        this.selectedIndex = (this.selectedIndex - 1 + items.length) % (items.length || 1);
        this.renderResults();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (items[this.selectedIndex]) {
          items[this.selectedIndex].action();
        }
      } else if (e.key === 'Escape') {
        this.close();
      }
    });

    this.backdrop.addEventListener('click', (e) => {
      if (e.target === this.backdrop) this.close();
    });

    this.renderResults();
  }

  renderResults() {
    if (!this.backdrop) return;
    const container = this.backdrop.querySelector('.cmd-palette-results');
    const items = this.getItems();

    if (!items.length) {
      container.innerHTML = `<div style="padding: var(--space-4); text-align: center; color: var(--text-muted);">No commands matching "${this.searchQuery}"</div>`;
      return;
    }

    container.innerHTML = items
      .map(
        (item, idx) => `
      <div class="cmd-item ${idx === this.selectedIndex ? 'selected' : ''}" data-index="${idx}">
        ${iconHtml(item.icon, 'icon-sm')}
        <div style="flex: 1; display: flex; justify-content: space-between; align-items: center;">
          <span>${item.title}</span>
          <span style="font-size: 0.72rem; color: var(--text-subtle);">${item.type}</span>
        </div>
      </div>
    `
      )
      .join('');

    container.querySelectorAll('.cmd-item').forEach((el) => {
      el.addEventListener('click', () => {
        const idx = parseInt(el.dataset.index, 10);
        if (items[idx]) items[idx].action();
      });
    });
  }

  close() {
    this.isOpen = false;
    if (this.backdrop && this.backdrop.parentElement) {
      this.backdrop.parentElement.removeChild(this.backdrop);
    }
    this.backdrop = null;
  }
}

export const commandPalette = new CommandPalette();
