/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Mulish', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      colors: {
        brand: {
          magenta: '#C5299B',
          navy: '#190072',
        },
        red: {
          50: '#fdf2fa',
          100: '#fce7f6',
          200: '#f9ceee',
          300: '#f4a6e0',
          400: '#ec6fcc',
          500: '#df44b6',
          600: '#C5299B',
          700: '#a31f7f',
          800: '#871c69',
          900: '#190072',
          950: '#11004d',
        },
        indigo: {
          50: '#eef0ff',
          100: '#dfe3ff',
          200: '#c6ccff',
          300: '#a3abff',
          400: '#7e82ff',
          500: '#5b56fa',
          600: '#190072',
          700: '#15005e',
          800: '#11004d',
          900: '#0d003b',
          950: '#080026',
        },
      },
    },
  },
  plugins: [],
};
