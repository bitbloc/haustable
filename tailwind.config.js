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
        canvas: 'var(--color-paper)',
        paper: 'var(--color-paper-2)',
        ink: 'var(--color-ink)',
        subInk: 'var(--color-neutral)',
        brand: 'var(--color-accent)',
        brandDark: 'var(--color-accent-2)',
        error: 'var(--color-accent-red)',
      },
      fontFamily: {
        sans: ['var(--font-body)'],
        display: ['var(--font-display)'],
        mono: ['var(--font-outlier)'],
      },
      borderRadius: {
        'rams': '4px', // Dieter Rams ชอบมุมมนเล็กน้อย ไม่กลมดิก
      },
      boxShadow: {
        'soft': 'none', // Remove soft shadow to enforce 1px borders
      }
    },
  },
  plugins: [],
}
