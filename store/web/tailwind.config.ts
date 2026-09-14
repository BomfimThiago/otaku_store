import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#f6f6f9',
          900: '#ffffff',
          800: '#eeeef3',
          700: '#e3e3ec',
          600: '#b9b6c8',
        },
        neon: {
          pink: '#d6246e',
          cyan: '#0e7490',
          violet: '#7c3aed',
          lime: '#2f7d32',
        },
        fg: '#17151f',
        muted: '#6b6580',
      },
      fontFamily: {
        sans: ['"Inter"', '"Noto Sans JP"', 'system-ui', 'sans-serif'],
        display: ['"Space Grotesk"', '"Noto Sans JP"', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        neon: '0 4px 14px rgba(23, 21, 31, 0.10)',
        'neon-cyan': '0 1px 3px rgba(23, 21, 31, 0.08), 0 1px 2px rgba(23, 21, 31, 0.04)',
      },
    },
  },
  plugins: [],
} satisfies Config;
