import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#07060d',
          900: '#0e0c1a',
          800: '#17142a',
          700: '#242040',
        },
        neon: {
          pink: '#ff2e88',
          cyan: '#22e4ff',
          violet: '#9d5cff',
          lime: '#b6ff3b',
        },
        fg: '#f4f2ff',
        muted: '#a9a3c7',
      },
      fontFamily: {
        sans: ['"Inter"', '"Noto Sans JP"', 'system-ui', 'sans-serif'],
        display: ['"Space Grotesk"', '"Noto Sans JP"', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        neon: '0 0 12px 2px rgba(255, 46, 136, 0.55)',
        'neon-cyan': '0 0 12px 2px rgba(34, 228, 255, 0.55)',
      },
    },
  },
  plugins: [],
} satisfies Config;
