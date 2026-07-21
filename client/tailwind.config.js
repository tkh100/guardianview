/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        slate: {
          850: '#1a2332',
        },
        brand: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
        },
        canvas: '#F7F5F0',
        ink: {
          DEFAULT: '#1F2A24',
          800: '#243329',
          700: '#2B3D31',
        },
        pine: {
          50: '#EAF1EE',
          100: '#D1E1DA',
          300: '#7FA396',
          400: '#4C7A6A',
          500: '#2F5D50',
          600: '#274F44',
          700: '#1E3D35',
        },
        trail: {
          50: '#FBF0E7',
          200: '#EBC49E',
          400: '#D6935C',
          500: '#C97A3D',
          600: '#B0632B',
        },
        birch: '#E8E2D3',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['Fraunces', 'ui-serif', 'Georgia', 'serif'],
      },
      boxShadow: {
        soft: '0 1px 2px 0 rgb(15 23 42 / 0.04), 0 1px 3px 0 rgb(15 23 42 / 0.06)',
        card: '0 1px 2px 0 rgb(15 23 42 / 0.03), 0 4px 16px -4px rgb(15 23 42 / 0.08)',
        'card-hover': '0 2px 4px 0 rgb(15 23 42 / 0.04), 0 12px 28px -6px rgb(15 23 42 / 0.14)',
        glow: '0 0 0 1px rgb(47 93 80 / 0.10), 0 8px 24px -8px rgb(47 93 80 / 0.45)',
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: 0, transform: 'translateY(4px)' },
          '100%': { opacity: 1, transform: 'translateY(0)' },
        },
        'ring-pulse': {
          '0%, 100%': { boxShadow: '0 0 0 0 rgb(244 63 94 / 0.45)' },
          '50%': { boxShadow: '0 0 0 6px rgb(244 63 94 / 0)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.35s ease-out both',
        'ring-pulse': 'ring-pulse 2s ease-in-out infinite',
        shimmer: 'shimmer 1.6s linear infinite',
      },
    },
  },
  plugins: [],
};
