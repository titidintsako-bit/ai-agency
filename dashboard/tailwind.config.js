/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Custom dark palette used throughout the dashboard
        surface: {
          DEFAULT: '#0d1117',  // page background
          card:    '#161b22',  // card / panel background
          border:  '#21262d',  // card borders
          input:   '#1c2128',  // input fields
        },
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
    },
  },
  plugins: [],
}
