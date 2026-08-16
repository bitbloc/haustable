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

// Initialize native WMA thermal printer socket bridge (for Sunmi D2s Plus)
initWmaNativeBridge();

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

// Auto-recover from stale chunks after new deployments
if (typeof window !== 'undefined') {
  window.addEventListener('vite:preloadError', (event) => {
    console.warn('[Vite] Dynamic import preload error detected. Reloading page for new deployment...', event);
    const lastReload = sessionStorage.getItem('vite_chunk_reload_ts');
    const now = Date.now();
    if (!lastReload || now - parseInt(lastReload, 10) > 10000) {
      sessionStorage.setItem('vite_chunk_reload_ts', now.toString());
      window.location.reload();
    }
  });
}

if (!Capacitor.isNativePlatform() && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(registration => {
        console.log('SW registered: ', registration);
      })
      .catch(registrationError => {
        console.log('SW registration failed: ', registrationError);
      });
  });
}

