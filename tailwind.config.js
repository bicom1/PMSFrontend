/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['DM Sans', 'Segoe UI', 'sans-serif'],
      },
      colors: {
        ink: {
          950: '#07111f',
          900: '#0b1f33',
          800: '#12304a',
        },
        brand: {
          50: '#f0fdfa',
          100: '#ccfbf1',
          600: '#0f766e',
          700: '#115e59',
        },
      },
      boxShadow: {
        card: '0 12px 32px -20px rgba(15, 23, 42, 0.45)',
      },
    },
  },
  plugins: [],
};
