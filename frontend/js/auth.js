/**
 * Authentication and Role Boundary Manager
 */

import { store } from './store.js';
import { api } from './api.js';

export const auth = {
  async init() {
    const { role } = store.getState();
    if (role) {
      const currentNav = store.getState().nav;
      if (!Array.isArray(currentNav) || currentNav.length === 0) {
        store.setState({
          nav: this.getDefaultNav(role),
          persona: store.getState().persona || this.getDefaultPersona(role),
        });
      }
      await this.refreshProfile();
    }
  },

  async selectRole(roleName, options = {}) {
    const instId = options.institutionId || (roleName === 'Institution' ? '1-1090123456' : null);
    const studentToken = options.studentToken || null;

    // Immediately seed store with default navigation & persona for role so sidebar renders instantly
    store.setState({
      role: roleName,
      persona: this.getDefaultPersona(roleName, instId),
      nav: this.getDefaultNav(roleName),
      institutionId: instId,
      studentToken: studentToken,
    });

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

    const profile = await this.refreshProfile();
    return profile;
  },

  async refreshProfile() {
    const { role } = store.getState();
    try {
      const data = await api.get('/api/v1/me');
      const activeRole = data.role || role;
      store.setState({
        role: activeRole,
        persona: data.persona || store.getState().persona || this.getDefaultPersona(activeRole),
        permissions: data.permissions || [],
        nav: (Array.isArray(data.nav) && data.nav.length > 0) ? data.nav : this.getDefaultNav(activeRole),
      });

      // Also refresh notifications in background
      this.refreshNotifications();

      return data;
    } catch (err) {
      console.warn('Could not refresh profile from server, using resilient role defaults:', err);
      if (role && (!store.getState().nav || store.getState().nav.length === 0)) {
        store.setState({
          nav: this.getDefaultNav(role),
          persona: store.getState().persona || this.getDefaultPersona(role),
        });
      }
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

  getDefaultNav(role) {
    switch (role) {
      case 'Officer':
        return [
          { id: 'overview', title: 'Overview', href: '#/officer/overview', icon: 'layout-dashboard' },
          { id: 'institutions', title: 'Institutions', href: '#/officer/institutions', icon: 'building-2' },
          { id: 'findings', title: 'Findings Inbox', href: '#/officer/findings', icon: 'alert-triangle' },
          { id: 'duplicates', title: 'Duplicates & Collisions', href: '#/officer/duplicates', icon: 'copy-check' },
          { id: 'verifications', title: 'Verification Activity', href: '#/officer/verifications', icon: 'shield-check' },
          { id: 'insights', title: 'Insights & Drills', href: '#/officer/insights', icon: 'line-chart' },
          { id: 'audit', title: 'Audit Log', href: '#/officer/audit', icon: 'history' },
          { id: 'rules', title: 'Rules & Limits', href: '#/officer/rules', icon: 'book-open' },
          { id: 'help', title: 'Help & Docs', href: '#/help', icon: 'help-circle' },
        ];
      case 'Institution':
        return [
          { id: 'overview', title: 'Overview', href: '#/college/overview', icon: 'layout-dashboard' },
          { id: 'upload', title: 'Upload Data', href: '#/college/upload', icon: 'upload-cloud' },
          { id: 'students', title: 'Students', href: '#/college/students', icon: 'users' },
          { id: 'certificates', title: 'Certificates', href: '#/college/certificates', icon: 'award' },
          { id: 'submissions', title: 'Submissions', href: '#/college/submissions', icon: 'file-clock' },
          { id: 'todos', title: 'To-do', href: '#/college/todos', icon: 'check-square' },
          { id: 'help', title: 'Help & Docs', href: '#/help', icon: 'help-circle' },
        ];
      case 'Student':
        return [
          { id: 'record', title: 'My Record', href: '#/student/record', icon: 'id-card' },
          { id: 'consent', title: 'Consent Ledger', href: '#/student/consent', icon: 'lock' },
          { id: 'activity', title: 'Who Viewed My Record', href: '#/student/activity', icon: 'eye' },
          { id: 'certificates', title: 'My Certificates', href: '#/student/certificates', icon: 'award' },
          { id: 'share', title: 'Share Credentials', href: '#/student/share', icon: 'share-2' },
          { id: 'help', title: 'Help & Docs', href: '#/help', icon: 'help-circle' },
        ];
      case 'Verifier':
        return [
          { id: 'verify', title: 'Verify Credential', href: '#/verify', icon: 'shield-check' },
          { id: 'guide', title: 'How Verification Works', href: '#/verify/guide', icon: 'info' },
          { id: 'help', title: 'Help & Docs', href: '#/help', icon: 'help-circle' },
        ];
      default:
        return [];
    }
  },

  getDefaultPersona(role, instId = null) {
    switch (role) {
      case 'Officer':
        return {
          name: 'Ananya Rao',
          designation: 'Scrutiny Officer',
          department: 'AICTE Regulation Bureau',
          badge: 'Central Oversight',
          email: 'ananya.rao@aicte-india.org',
          initials: 'AR',
        };
      case 'Institution':
        return {
          name: 'Dr. K. S. Verma',
          designation: 'College Registrar',
          institution_id: instId || '1-1090123456',
          institution_name: 'Aryabhata Institute of Technology',
          badge: 'AICTE Approved',
          initials: 'KV',
        };
      case 'Student':
        return {
          name: 'Rohan Aditya Sharma',
          apaar_masked: 'XXXX-XXXX-1100',
          programme: 'B.Tech Computer Science and Engineering',
          institution_name: 'Aryabhata Institute of Technology',
          badge: 'APAAR Verified',
          initials: 'RS',
        };
      case 'Verifier':
        return {
          name: 'Public Verifier',
          designation: 'Verification Gateway',
          badge: 'Public Access',
          initials: 'PV',
        };
      default:
        return null;
    }
  },
};
