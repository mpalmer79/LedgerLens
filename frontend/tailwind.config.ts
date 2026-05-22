import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  'var(--brand-50)',
          100: 'var(--brand-100)',
          200: 'var(--brand-200)',
          300: 'var(--brand-300)',
          400: 'var(--brand-400)',
          500: 'var(--brand-500)',
          600: 'var(--brand-600)',
          700: 'var(--brand-700)',
          800: 'var(--brand-800)',
          900: 'var(--brand-900)',
        },
        accent: {
          400: 'var(--accent-400)',
          500: 'var(--accent-500)',
          600: 'var(--accent-600)',
        },
        severity: {
          low:      'var(--severity-low)',
          moderate: 'var(--severity-moderate)',
          high:     'var(--severity-high)',
          critical: 'var(--severity-critical)',
        },
        surface: {
          page:            'var(--surface-page)',
          panel:           'var(--surface-panel)',
          sunken:          'var(--surface-sunken)',
          border:          'var(--surface-border)',
          'border-strong': 'var(--surface-border-strong)',
        },
        text: {
          primary:   'var(--text-primary)',
          secondary: 'var(--text-secondary)',
          subtle:    'var(--text-subtle)',
          disabled:  'var(--text-disabled)',
        },
      },
      fontFamily: {
        display: ['var(--font-display)', 'Georgia', 'serif'],
        sans:    ['var(--font-ui)', 'system-ui', 'sans-serif'],
        mono:    ['var(--font-mono)', 'Menlo', 'monospace'],
      },
      borderRadius: {
        DEFAULT: 'var(--radius-md)',
        sm:      'var(--radius-sm)',
        md:      'var(--radius-md)',
        lg:      'var(--radius-lg)',
      },
      boxShadow: {
        sm: 'var(--shadow-sm)',
        md: 'var(--shadow-md)',
        lg: 'var(--shadow-lg)',
      },
      transitionDuration: {
        micro:  '100ms',
        short:  '180ms',
        medium: '300ms',
        long:   '500ms',
      },
      transitionTimingFunction: {
        'out-expo': 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
    },
  },
  plugins: [],
};

export default config;
