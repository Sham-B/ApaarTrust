/**
 * Reactive Central State Store for ApaarTrust
 */

const STORAGE_KEY_ROLE = 'apaartrust_role';
const STORAGE_KEY_THEME = 'apaartrust_theme';
const STORAGE_KEY_LANG = 'apaartrust_lang';

class Store {
  constructor() {
    this.state = {
      role: localStorage.getItem(STORAGE_KEY_ROLE) || null,
      persona: null,
      permissions: [],
      nav: [],
      theme: localStorage.getItem(STORAGE_KEY_THEME) || 'light',
      lang: localStorage.getItem(STORAGE_KEY_LANG) || 'en',
      density: 'comfortable',
      notifications: { unread_count: 0, items: [] },
      toasts: [],
      institutionId: '1-1090123456',
      studentToken: null,
      isCopilotOpen: false,
      isCommandPaletteOpen: false,
      isShortcutsOpen: false,
    };
    this.listeners = new Set();
  }

  getState() {
    return this.state;
  }

  setState(updates) {
    this.state = { ...this.state, ...updates };

    if ('role' in updates) {
      if (updates.role) {
        localStorage.setItem(STORAGE_KEY_ROLE, updates.role);
      } else {
        localStorage.removeItem(STORAGE_KEY_ROLE);
      }
    }

    if ('theme' in updates) {
      localStorage.setItem(STORAGE_KEY_THEME, updates.theme);
      document.documentElement.setAttribute('data-theme', updates.theme);
    }

    if ('lang' in updates) {
      localStorage.setItem(STORAGE_KEY_LANG, updates.lang);
      document.documentElement.setAttribute('lang', updates.lang);
    }

    this.notify();
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notify() {
    for (const listener of this.listeners) {
      try {
        listener(this.state);
      } catch (err) {
        console.error('Store notification error:', err);
      }
    }
  }

  setTheme(theme) {
    this.setState({ theme });
  }

  toggleTheme() {
    this.setTheme(this.state.theme === 'dark' ? 'light' : 'dark');
  }

  setLang(lang) {
    this.setState({ lang });
  }

  toggleLang() {
    const current = this.state.lang;
    const next = current === 'en' ? 'hi' : current === 'hi' ? 'ta' : 'en';
    this.setLang(next);
  }

  setDensity(density) {
    this.setState({ density });
  }

  setCopilotOpen(isOpen) {
    this.setState({ isCopilotOpen: isOpen });
  }

  setCommandPaletteOpen(isOpen) {
    this.setState({ isCommandPaletteOpen: isOpen });
  }

  setShortcutsOpen(isOpen) {
    this.setState({ isShortcutsOpen: isOpen });
  }

  clearRole() {
    this.setState({
      role: null,
      persona: null,
      permissions: [],
      nav: [],
      studentToken: null,
    });
  }
}

export const store = new Store();
