import React from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { LanguageProvider } from './context/LanguageContext.jsx'
import { Capacitor } from '@capacitor/core'
import { CapacitorUpdater } from '@capgo/capacitor-updater'
import { logger } from './utils/logger.js'
import { initWmaNativeBridge } from './utils/wmaNativeBridge.js'

// Initialize local crash reporting and debug logs
logger.init();

// Initialize native WMA thermal printer socket bridge (temporarily disabled per user request)
// initWmaNativeBridge();

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

// Auto-recover from stale chunks / MIME type errors after new deployments
if (typeof window !== 'undefined') {
  const triggerAutoReload = (reason) => {
    console.warn('[Vite/App] Chunk / MIME load error detected:', reason);
    const lastReload = sessionStorage.getItem('chunk_reload_retry_ts');
    const now = Date.now();
    // Guard against reload loops: allow max 1 auto-reload every 10 seconds
    if (!lastReload || now - parseInt(lastReload, 10) > 10000) {
      sessionStorage.setItem('chunk_reload_retry_ts', now.toString());
      if ('caches' in window) {
        caches.keys().then((keys) => {
          return Promise.all(keys.map((k) => caches.delete(k)));
        }).finally(() => {
          window.location.reload();
        });
      } else {
        window.location.reload();
      }
    }
  };

  window.addEventListener('vite:preloadError', (event) => {
    triggerAutoReload('vite:preloadError');
  });

  window.addEventListener('error', (event) => {
    const msg = event?.message || '';
    if (
      msg.includes('text/html') ||
      msg.includes('is not a valid JavaScript MIME type') ||
      msg.includes('Failed to fetch dynamically imported module') ||
      msg.includes('error loading dynamically imported module')
    ) {
      triggerAutoReload(msg);
    }
  });

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event?.reason?.message || event?.reason || '';
    const reasonStr = typeof reason === 'string' ? reason : JSON.stringify(reason);
    if (
      reasonStr.includes('text/html') ||
      reasonStr.includes('is not a valid JavaScript MIME type') ||
      reasonStr.includes('Failed to fetch dynamically imported module') ||
      reasonStr.includes('error loading dynamically imported module')
    ) {
      triggerAutoReload(reasonStr);
    }
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

