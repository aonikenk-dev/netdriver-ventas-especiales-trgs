import type { Config } from 'tailwindcss';

export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        obsidian: '#F5F7FA',
        carbon: '#FFFFFF',
        slate: '#ECEFF3',
        border: '#D7DCE3',
        sienna: '#C0623A',
        moss: '#3D6B4F',
        ice: '#7BAFC4',
        white: '#FFFFFF',
        ink: '#15181C',
      },
      fontFamily: {
        display: ['Syne', 'sans-serif'],
        mono: ['"DM Mono"', 'monospace'],
      },
      borderRadius: {
        DEFAULT: '0.375rem',
      },
    },
  },
  plugins: [],
} satisfies Config;
