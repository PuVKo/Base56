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
          bg: '#191919',
          surface: '#252525',
          border: '#373737',
          hover: '#2f2f2f',
          muted: '#9b9b9b',
        },
      },
    },
  },
  plugins: [],
};
