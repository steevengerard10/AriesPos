/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        bg:      'var(--bg)',
        bg2:     'var(--bg2)',
        bg3:     'var(--bg3)',
        bg4:     'var(--bg4)',
        border:  'var(--border)',
        border2: 'var(--border2)',
        accent:  'var(--accent)',
        accent2: 'var(--accent2)',
        accent3: 'var(--accent3)',
        warn:    'var(--warn)',
        danger:  'var(--danger)',
        clrtext:  'var(--text)',
        clrtext2: 'var(--text2)',
        clrtext3: 'var(--text3)',
        primary: { 500: 'var(--accent)', 600: 'var(--accent)' },
      },
      fontFamily: {
        sans:    ['Syne', 'system-ui', 'sans-serif'],
        mono:    ['DM Mono', 'JetBrains Mono', 'Consolas', 'monospace'],
        display: ['Syne', 'system-ui', 'sans-serif'],
      },
      animation: {
        'fade-in':    'fadeIn 0.15s ease-in-out',
        'slide-in':   'slideIn 0.2s ease-out',
        'slide-left': 'slideLeft 0.25s ease-out',
        'pulse-dot':  'pulseDot 2s ease-in-out infinite',
        'fade-up':    'fadeUp 0.2s ease-out',
      },
      keyframes: {
        fadeIn:    { '0%': { opacity: '0' },                                          '100%': { opacity: '1' } },
        slideIn:   { '0%': { transform: 'translateY(-6px)', opacity: '0' },           '100%': { transform: 'translateY(0)', opacity: '1' } },
        slideLeft: { '0%': { transform: 'translateX(16px)', opacity: '0' },           '100%': { transform: 'translateX(0)', opacity: '1' } },
        pulseDot:  { '0%,100%': { opacity: '1', transform: 'scale(1)' },              '50%': { opacity: '0.4', transform: 'scale(0.8)' } },
        fadeUp:    { 'from': { transform: 'translateY(6px)', opacity: '0' },          'to': { transform: 'translateY(0)', opacity: '1' } },
      },
    },
  },
  plugins: [],
};
