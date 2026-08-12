/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        void: 'rgb(var(--c-void) / <alpha-value>)',
        nebula: {
          bg: 'rgb(var(--c-bg) / <alpha-value>)',
          surface: 'rgb(var(--c-surface) / <alpha-value>)',
          border: 'rgb(var(--c-border) / <alpha-value>)',
          violet: 'rgb(var(--c-violet) / <alpha-value>)',
          cyan: 'rgb(var(--c-cyan) / <alpha-value>)',
          star: 'rgb(var(--c-star) / <alpha-value>)',
          pink: 'rgb(var(--c-pink) / <alpha-value>)',
          text: 'rgb(var(--c-text) / <alpha-value>)',
          muted: 'rgb(var(--c-muted) / <alpha-value>)'
        }
      },
      fontFamily: {
        display: ['"Space Grotesk"', 'sans-serif'],
        body: ['"Inter"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
        script: ['"Instrument Serif"', 'serif']
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
