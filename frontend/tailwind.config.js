/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f0f7ff',
          100: '#e0effe',
          200: '#b9dffe',
          300: '#7cc3fd',
          400: '#36a3fa',
          500: '#0c87eb',
          600: '#006bc9',
          700: '#0155a3',
          800: '#064986',
          900: '#0b3d6f',
          950: '#07274a',
        },
      },
    },
  },
  plugins: [],
}
