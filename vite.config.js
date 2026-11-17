import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import os from 'os'

function getLocalIp() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      // Create a comprehensive filter to confirm it's a valid LAN IP
      if (iface.family === 'IPv4' && !iface.internal) {
          return iface.address;
      }
    }
  }
  return 'localhost';
}

const localIp = getLocalIp()

// Dev only: /link is rendered by api/link.js in production (see the rewrite in vercel.json),
// so serve the same function here. Without this, local /link shows the old React page.
function liveLandingPage() {
  return {
    name: 'live-landing-page',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const pathname = (req.url || '').split('?')[0]
        if (pathname !== '/link' && pathname !== '/link/') return next()
        try {
          const mod = await server.ssrLoadModule('/api/link.js')
          const shim = {
            setHeader: (key, value) => { res.setHeader(key, value); return shim },
            status: (code) => { res.statusCode = code; return shim },
            send: (body) => res.end(body),
          }
          await mod.default(req, shim)
        } catch (err) {
          next(err)
        }
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), liveLandingPage()],
  define: {
    'process.env.HOST_IP': JSON.stringify(localIp)
  },
  envPrefix: ['VITE_', 'NEXT_PUBLIC_'],
  build: {
    // วิธีแก้แบบ Pro: สั่งแยกไฟล์ Library ออกไปเป็นไฟล์ชื่อ vendor
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Tiny shared runtime helpers. Left alone, Rollup can file them inside whichever manual
          // chunk saw them first (it once put vite's preload helper in vendor-pdf, so every page
          // downloaded jsPDF). Pin them next to React, which every page loads anyway.
          if (id.includes('vite/preload-helper') || id.includes('commonjsHelpers') || id.includes('@babel/runtime')) {
            return 'vendor-react';
          }
          if (id.includes('node_modules')) {
            // React + router: needed by every page, cached across routes
            if (/node_modules[\\/](react|react-dom|scheduler|react-router|react-router-dom)[\\/]/.test(id)) {
              return 'vendor-react';
            }
            if (id.includes('phaser')) {
              return 'vendor-phaser';
            }
            if (id.includes('@dnd-kit') || id.includes('dnd-kit')) {
              return 'vendor-dnd';
            }
            if (id.includes('lucide-react')) {
              return 'vendor-icons';
            }
            if (id.includes('sonner')) {
              return 'vendor-toast';
            }
            if (id.includes('framer-motion') || id.includes('react-zoom-pan-pinch')) {
              return 'vendor-ui';
            }
            if (id.includes('opentype')) {
              return 'vendor-opentype';
            }
            if (id.includes('html2canvas') || id.includes('html-to-image') || id.includes('canvas-confetti')) {
              return 'vendor-canvas';
            }
            // Camera QR scanner (POS / staff only) stays apart from the small QR renderer
            // customers see at checkout, so checkout does not download the scanner.
            if (id.includes('html5-qrcode') || id.includes('barcode-detector') || id.includes('zxing')) {
              return 'vendor-qrscan';
            }
            if (id.includes('qrcode') || id.includes('promptpay-qr')) {
              return 'vendor-qrcode';
            }
            if (id.includes('date-fns')) {
              return 'vendor-date';
            }
            if (id.includes('three')) {
              return 'vendor-three';
            }
            if (id.includes('exceljs')) {
              return 'vendor-excel';
            }
            if (id.includes('jspdf')) {
              return 'vendor-pdf';
            }
            if (id.includes('supabase')) {
              return 'vendor-supabase';
            }
            // Everything else (canvg, dompurify, pako, BLE / Sunmi printer plugins, ...) is
            // left to Rollup, so it ships with the POS / admin chunk that imports it instead of
            // one shared "vendor" file that every customer page had to download.
            return undefined;
          }
        },
      },
    },
    // ใส่ chunkSizeWarningLimit เผื่อไว้ด้วยก็ได้
    chunkSizeWarningLimit: 1000,
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/setupTests.js',
  },
})