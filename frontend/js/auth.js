/**
 * Authentication and Role Boundary Manager
 */

import { store } from './store.js';
import { api } from './api.js';

export const auth = {
  async init() {
    const { role } = store.getState();
    if (role) {
      await this.refreshProfile();
    }
  },

  async selectRole(roleName, options = {}) {
    const instId = options.institutionId || (roleName === 'Institution' ? '1-1090123456' : null);
    const studentToken = options.studentToken || null;

    try {
      const signinRes = await api.post('/api/v1/demo/signin', {
        role: roleName,
        institution_id: instId,
        student_token: studentToken,
      });
      if (signinRes && signinRes.access_token) {
        sessionStorage.setItem('apaar_token', signinRes.access_token);
      }
    } catch (err) {
      console.warn('Demo signin token request failed, proceeding with local context:', err);
    }

    store.setState({
      role: roleName,
      institutionId: instId,
      studentToken: studentToken,
    });

    const profile = await this.refreshProfile();
    return profile;
  },

  async refreshProfile() {
    try {
      const data = await api.get('/api/v1/me');
      store.setState({
        role: data.role,
        persona: data.persona,
        permissions: data.permissions || [],
        nav: data.nav || [],
      });

      // Also refresh notifications in background
      this.refreshNotifications();

      return data;
    } catch (err) {
      console.warn('Could not refresh profile:', err);
      return null;
    }
  },

  async refreshNotifications() {
    try {
      const notifs = await api.get('/api/v1/notifications');
      store.setState({ notifications: notifs });
    } catch (err) {
      // ignore
    }
  },

  logoutToLanding() {
    sessionStorage.removeItem('apaar_token');
    store.clearRole();
    window.location.hash = '#/';
  },

  canAccessRoute(hash) {
    const path = hash.replace(/^#\/?/, '').split('?')[0];
    const { role } = store.getState();

    // Landing and help are accessible to all
    if (!path || path === '/' || path === 'help' || path.startsWith('help/')) {
      return true;
    }

    // Public verify is open
    if (path.startsWith('verify')) {
      return true;
    }

    // Role-specific sections
    if (path.startsWith('officer/')) {
      return role === 'Officer';
    }

    if (path.startsWith('college/')) {
      return role === 'Institution';
    }

    if (path.startsWith('student/')) {
      return role === 'Student';
    }

    return true;
  },

  getRoleHome(role) {
    switch (role) {
      case 'Officer':
        return '#/officer/overview';
      case 'Institution':
        return '#/college/overview';
      case 'Student':
        return '#/student/record';
      case 'Verifier':
        return '#/verify';
      default:
        return '#/';
    }
  },
};
