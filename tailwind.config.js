/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Dieter Rams Palette
        canvas: '#F4F4F4',       // สีพื้นหลังเทาอ่อนมากๆ (Off-white)
        paper: '#FFFFFF',        // สีพื้นหลังการ์ด (ขาวสนิท)
        ink: '#111111',          // สีตัวหนังสือ (ดำเกือบสนิท)
        subInk: '#888888',       // สีตัวหนังสือรอง (เทา)
        brand: '#DFFF00',        // สีเขียวนีออน (Accent)
        brandDark: '#B2CC00',    // สีเขียวเข้ม (Hover state)
        error: '#FF3B30',        // สีแดง (System Alert)
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
