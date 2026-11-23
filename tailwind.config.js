/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      colors: {
        primary: {
          50: '#fef2f2',
          100: '#fee2e2',
          200: '#fecaca',
          300: '#fca5a5',
          400: '#f87171',
          500: '#ef4444',
          600: '#dc2626',
          700: '#b91c1c',
          800: '#991b1b',
          900: '#7f1d1d',
        },
        movsat: {
          brand: 'rgb(var(--ms-color-brand) / <alpha-value>)',
          'brand-hover': 'rgb(var(--ms-color-brand-hover) / <alpha-value>)',
          canvas: 'rgb(var(--ms-color-canvas) / <alpha-value>)',
          surface: 'rgb(var(--ms-color-surface) / <alpha-value>)',
          text: 'rgb(var(--ms-color-text) / <alpha-value>)',
          muted: 'rgb(var(--ms-color-text-muted) / <alpha-value>)',
          border: 'rgb(var(--ms-color-border) / <alpha-value>)',
          success: 'rgb(var(--ms-color-success) / <alpha-value>)',
          warning: 'rgb(var(--ms-color-warning) / <alpha-value>)',
          danger: 'rgb(var(--ms-color-danger) / <alpha-value>)',
          info: 'rgb(var(--ms-color-info) / <alpha-value>)',
        },
      },
    },
  },
  plugins: [],
};
