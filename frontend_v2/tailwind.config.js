export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        ocean: {
          50: '#edf8ff',
          100: '#d1edff',
          200: '#a8deff',
          300: '#6cc8ff',
          400: '#2c9fff',
          500: '#0872ff',
          600: '#0056db',
          700: '#003fa6',
          800: '#00317d',
          900: '#002964',
        },
        emerald: {
          50: '#edfbf7',
          100: '#d1f4e7',
          200: '#a7e7d1',
          300: '#72d6b7',
          400: '#3abf96',
          500: '#14a075',
          600: '#0e815e',
          700: '#0c694d',
          800: '#0b523d',
          900: '#0a4533',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        glow: '0 0 25px rgba(59, 130, 246, 0.2)',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};
