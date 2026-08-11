/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        void: '#07070d',
        nebula: {
          bg: '#0b0c14',
          surface: '#12131f',
          border: '#22243a',
          violet: '#7c5cfc',
          cyan: '#23d9d9',
          star: '#ffd166',
          pink: '#ff5c9e',
          text: '#e8e9f5',
          muted: '#8b8da8'
        }
      },
      fontFamily: {
        display: ['"Space Grotesk"', 'sans-serif'],
        body: ['"Inter"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace']
      },
      backgroundImage: {
        'nebula-gradient': 'radial-gradient(ellipse at top, rgba(124,92,252,0.18), transparent 60%), radial-gradient(ellipse at bottom right, rgba(35,217,217,0.12), transparent 55%)',
      },
      boxShadow: {
        glow: '0 0 20px rgba(124,92,252,0.35)',
      }
    },
  },
  plugins: [],
}
