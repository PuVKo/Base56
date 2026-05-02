/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['ui-sans-serif', 'system-ui', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
      },
      colors: {
        notion: {
          bg: 'rgb(var(--notion-bg) / <alpha-value>)',
          surface: 'rgb(var(--notion-surface) / <alpha-value>)',
          border: 'rgb(var(--notion-border) / <alpha-value>)',
          hover: 'rgb(var(--notion-hover) / <alpha-value>)',
          muted: 'rgb(var(--notion-muted) / <alpha-value>)',
          fg: 'rgb(var(--notion-fg) / <alpha-value>)',
        },
        brand: {
          DEFAULT: 'rgb(var(--brand-rgb) / <alpha-value>)',
        },
      },
    },
  },
  plugins: [],
};
