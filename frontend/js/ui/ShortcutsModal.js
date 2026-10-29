/**
 * Keyboard Shortcuts Modal ("?")
 */

import { Modal } from './Modal.js';

export function openShortcutsModal() {
  const content = `
    <div style="display: flex; flex-direction: column; gap: var(--space-3); font-size: 0.88rem;">
      <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-subtle); padding-bottom: 6px;">
        <span>Open command palette</span>
        <span class="kbd-shortcut">Ctrl / ⌘ + K</span>
      </div>
      <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-subtle); padding-bottom: 6px;">
        <span>Open keyboard shortcuts</span>
        <span class="kbd-shortcut">?</span>
      </div>
      <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-subtle); padding-bottom: 6px;">
        <span>Toggle AI Compliance Copilot</span>
        <span class="kbd-shortcut">Ctrl / ⌘ + /</span>
      </div>
      <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-subtle); padding-bottom: 6px;">
        <span>Close modals or active drawer</span>
        <span class="kbd-shortcut">Esc</span>
      </div>
      <div style="display: flex; justify-content: space-between; align-items: center; padding-bottom: 6px;">
        <span>Cycle command palette list</span>
        <span class="kbd-shortcut">↑ / ↓</span>
      </div>
    </div>
  `;

  const modal = new Modal({
    title: 'Keyboard shortcuts',
    content,
    footer: `
      <button class="btn btn-primary btn-sm btn-close-modal">Got it</button>
    `,
  });

  modal.open();
  const btn = modal.backdrop.querySelector('.btn-close-modal');
  if (btn) btn.addEventListener('click', () => modal.close());
}

window.addEventListener('apaar:open-shortcuts', openShortcutsModal);

window.addEventListener('keydown', (e) => {
  const tag = (e.target && e.target.tagName) || '';
  if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target && e.target.isContentEditable)) return;
  if (e.key === '?') {
    e.preventDefault();
    openShortcutsModal();
  }
});
