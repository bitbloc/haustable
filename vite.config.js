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
            if (id.includes('lucide-react')) {
              return 'vendor-icons';
            }
            if (id.includes('framer-motion')) {
              return 'vendor-ui';
            }
            if (id.includes('recharts')) {
              return 'vendor-charts';
            }
            if (id.includes('supabase')) {
              return 'vendor-supabase'; // Supabase client is decent size
            }
            return 'vendor'; // functional & others
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