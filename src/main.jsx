import React from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { LanguageProvider } from './context/LanguageContext.jsx'
import { Capacitor } from '@capacitor/core'
import { CapacitorUpdater } from '@capgo/capacitor-updater'
import { logger } from './utils/logger.js'
import { nextChunkReload, isChunkLoadError } from './utils/chunkReload.js'

// Initialize local crash reporting and debug logs
logger.init();

// Notify Capgo that the app is ready (to prevent rollback on update)
if (Capacitor.isNativePlatform()) {
  try {
    CapacitorUpdater.notifyAppReady();
  } catch (e) {
    console.warn('Failed to notify app ready for Capgo:', e);
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <LanguageProvider>
      <App />
    </LanguageProvider>
  </React.StrictMode>,
)

// Auto-recover from stale chunks / MIME type errors after new deployments.
// The policy (reload now, then after 2 s, then 5 s, then stop) lives in utils/chunkReload.js.
if (typeof window !== 'undefined') {
  const KEY = 'chunk_reload_state';
  let pending = false;
  const triggerAutoReload = (reason) => {
    console.warn('[Vite/App] Chunk / MIME load error detected:', reason);
    if (pending) return;
    let state = null;
    try { state = JSON.parse(sessionStorage.getItem(KEY) || 'null'); } catch { /* start over */ }
    const step = nextChunkReload(state);
    if (!step.reload) return; // tried three times: the error screen takes over
    pending = true;
    try { sessionStorage.setItem(KEY, JSON.stringify(step.next)); } catch { /* storage unavailable */ }
    const reload = () => {
      const go = () => window.location.reload();
      if ('caches' in window) {
        caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k)))).finally(go);
      } else {
        go();
      }
    };
    setTimeout(reload, step.delay);
  };
  window.__chunkAutoReload = triggerAutoReload;

  window.addEventListener('vite:preloadError', () => {
    triggerAutoReload('vite:preloadError');
  });

  window.addEventListener('error', (event) => {
    const msg = event?.message || '';
    if (isChunkLoadError(msg)) triggerAutoReload(msg);
  });

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event?.reason?.message || event?.reason || '';
    const reasonStr = typeof reason === 'string' ? reason : JSON.stringify(reason);
    if (isChunkLoadError(reasonStr)) triggerAutoReload(reasonStr);
  });
}

if (!Capacitor.isNativePlatform() && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(registration => {
        console.log('SW registered: ', registration);
        // Check for updates periodically
        registration.update().catch(() => {});
      })
      .catch(registrationError => {
        console.log('SW registration failed: ', registrationError);
      });
  });
}

