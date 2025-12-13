import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    // วิธีแก้แบบ Pro: สั่งแยกไฟล์ Library ออกไปเป็นไฟล์ชื่อ vendor
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            return 'vendor';
          }
        },
      },
    },
    // ใส่ chunkSizeWarningLimit เผื่อไว้ด้วยก็ได้
    chunkSizeWarningLimit: 1000,
  },
})