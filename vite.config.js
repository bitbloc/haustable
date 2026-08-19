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

export default defineConfig({
  plugins: [react()],
  define: {
    'process.env.HOST_IP': JSON.stringify(localIp)
  },
  envPrefix: ['VITE_', 'NEXT_PUBLIC_'],
  build: {
    // วิธีแก้แบบ Pro: สั่งแยกไฟล์ Library ออกไปเป็นไฟล์ชื่อ vendor
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('phaser')) {
              return 'vendor-phaser';
            }
            if (id.includes('firebase')) {
              return 'vendor-firebase';
            }
            if (id.includes('@dnd-kit') || id.includes('dnd-kit')) {
              return 'vendor-dnd';
            }
            if (id.includes('lucide-react')) {
              return 'vendor-icons';
            }
            if (id.includes('framer-motion') || id.includes('react-zoom-pan-pinch') || id.includes('sonner')) {
              return 'vendor-ui';
            }
            if (id.includes('html2canvas') || id.includes('html-to-image') || id.includes('canvas-confetti')) {
              return 'vendor-canvas';
            }
            if (id.includes('html5-qrcode') || id.includes('qrcode') || id.includes('promptpay-qr')) {
              return 'vendor-qrcode';
            }
            if (id.includes('date-fns')) {
              return 'vendor-date';
            }
            if (id.includes('supabase')) {
              return 'vendor-supabase';
            }
            return 'vendor';
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