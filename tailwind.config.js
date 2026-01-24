/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // The Haus Workspace Palette
        canvas: '#FFFFFF',       // Pure White (Requested: Fix "muddy green")
        paper: '#FFFFFF',        // Pure White
        ink: '#1A1A1A',          // Deep Charcoal
        subInk: '#888888',       // Muted Gray
        brand: '#DFFF00',        // Acid Green
        brandDark: '#B2CC00',    // Darker Acid Green (Hover)
        error: '#FF3B30',        // System Red
      },
      fontFamily: {
        sans: ['Inter', 'Helvetica Neue', 'Arial', 'sans-serif'], // ฟอนต์ไม่มีหัว อ่านง่าย
      },
      borderRadius: {
        'rams': '4px', // Dieter Rams ชอบมุมมนเล็กน้อย ไม่กลมดิก
      },
      boxShadow: {
        'soft': '0 4px 20px rgba(0, 0, 0, 0.05)', // เงาฟุ้งๆ นุ่มๆ
      }
    },
  },
  plugins: [],
}
