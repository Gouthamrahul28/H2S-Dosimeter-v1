/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        safetrack: {
          bg: '#080C14',
          surface: '#0F172A',
          card: '#151F36',
          border: '#1E2D4A',
          muted: '#64748B',
          accent: '#0EA5E9',
          safe: '#10B981',
          trace: '#06B6D4',
          caution: '#F59E0B',
          danger: '#EF4444',
          idlh: '#7F1D1D',
        }
      },
      fontFamily: {
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      animation: {
        'pulse-fast': 'pulse 1s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'danger-glow': 'dangerGlow 1.5s ease-in-out infinite alternate',
      },
      keyframes: {
        dangerGlow: {
          '0%': { boxShadow: '0 0 10px rgba(239, 68, 68, 0.4)' },
          '100%': { boxShadow: '0 0 25px rgba(239, 68, 68, 0.9)' },
        }
      }
    },
  },
  plugins: [],
};
