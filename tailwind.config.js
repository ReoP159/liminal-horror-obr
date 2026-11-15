/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        liminal: {
          bg: '#0f1115',
          card: '#161922',
          border: '#2a2f3d',
          accent: '#d9383a', // Dread/danger crimson
          muted: '#8e96a8',
          paper: '#f3ece2',
          ink: '#111317',
          toxic: '#39c278' // Supernatural green/cyan hue
        }
      },
      fontFamily: {
        mono: ['Courier New', 'Courier', 'monospace']
      }
    },
  },
  plugins: [],
}
