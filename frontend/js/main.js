/**
 * ApaarTrust Main Frontend Entry Point
 */

import { store } from './store.js';
import { auth } from './auth.js';
import { router } from './router.js';
import { idleManager } from './idle.js';
import { previewManager } from './preview.js';
import './ui/Toast.js';
import './ui/CommandPalette.js';
import './ui/ShortcutsModal.js';
import './ui/CopilotDrawer.js';
import './ui/Tour.js';
import './ui/DemoControls.js';

async function bootstrap() {
  // Initialize idle and preview managers
  idleManager.init();
  previewManager.init();

  // Sync initial theme
  const initialTheme = store.getState().theme;
  document.documentElement.setAttribute('data-theme', initialTheme);

  // Sync initial lang
  const initialLang = store.getState().lang;
  document.documentElement.setAttribute('lang', initialLang);

  // Expose on window for diagnostics and test instrumentation
  window.store = store;
  window.auth = auth;
  window.router = router;

  // Initialize Auth
  await auth.init();

  // Trigger initial route
  await router.handleRoute();
}

bootstrap().catch((err) => {
  console.error('ApaarTrust application failed to bootstrap:', err);
});
