import type { Config } from 'tailwindcss';

/**
 * Tandem Tailwind config.
 * Design tokens come from app/globals.css :root variables.
 * Reference: docs/UI-IA.md §5
 */
const config: Config = {
  darkMode: 'class',
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      // -------- Color (mix of shadcn HSL + Tandem RGB tokens) --------
      colors: {
        // shadcn semantic (HSL via CSS vars)
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },

        // Tandem brand (RGB via CSS vars - rgb(var(--brand-500)) usage)
        brand: {
          50:  'rgb(var(--brand-50) / <alpha-value>)',
          100: 'rgb(var(--brand-100) / <alpha-value>)',
          200: 'rgb(var(--brand-200) / <alpha-value>)',
          300: 'rgb(var(--brand-300) / <alpha-value>)',
          400: 'rgb(var(--brand-400) / <alpha-value>)',
          500: 'rgb(var(--brand-500) / <alpha-value>)',
          600: 'rgb(var(--brand-600) / <alpha-value>)',
          700: 'rgb(var(--brand-700) / <alpha-value>)',
          800: 'rgb(var(--brand-800) / <alpha-value>)',
          900: 'rgb(var(--brand-900) / <alpha-value>)',
        },

        // Surfaces (Apple System Gray)
        surface: {
          1: 'rgb(var(--surface-1) / <alpha-value>)',
          2: 'rgb(var(--surface-2) / <alpha-value>)',
          3: 'rgb(var(--surface-3) / <alpha-value>)',
        },

        // Text tokens
        ink: {
          primary:   'rgb(var(--text-primary) / <alpha-value>)',
          secondary: 'rgb(var(--text-secondary) / <alpha-value>)',
          tertiary:  'rgb(var(--text-tertiary) / <alpha-value>)',
        },

        // Semantic
        success: 'rgb(var(--semantic-success) / <alpha-value>)',
        warning: 'rgb(var(--semantic-warning) / <alpha-value>)',
        danger:  'rgb(var(--semantic-danger) / <alpha-value>)',
        info:    'rgb(var(--semantic-info) / <alpha-value>)',

        // Persona stages
        persona: {
          newborn:    'rgb(var(--persona-newborn) / <alpha-value>)',
          apprentice: 'rgb(var(--persona-apprentice) / <alpha-value>)',
          assistant:  'rgb(var(--persona-assistant) / <alpha-value>)',
          deputy:     'rgb(var(--persona-deputy) / <alpha-value>)',
          partner:    'rgb(var(--persona-partner) / <alpha-value>)',
        },
      },

      // -------- Typography --------
      fontFamily: {
        sans: [
          'SF Pro Text',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI Variable Text',
          'Segoe UI',
          'PingFang SC',
          'Microsoft YaHei UI',
          'Microsoft YaHei',
          'Source Han Sans CN',
          'Hiragino Sans GB',
          'Inter',
          'system-ui',
          'sans-serif',
        ],
        display: [
          'SF Pro Display',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI Variable Display',
          'Segoe UI',
          'PingFang SC',
          'Microsoft YaHei UI',
          'system-ui',
          'sans-serif',
        ],
        mono: [
          'SF Mono',
          'Menlo',
          'Cascadia Code',
          'Consolas',
          'Liberation Mono',
          'monospace',
        ],
      },

      fontSize: {
        // 8-step Apple Type Scale (paired with class utilities in globals.css)
        display:  ['56px', { lineHeight: '1.05', letterSpacing: '-0.02em',  fontWeight: '700' }],
        'title-1':['36px', { lineHeight: '1.1',  letterSpacing: '-0.015em', fontWeight: '700' }],
        'title-2':['28px', { lineHeight: '1.2',  letterSpacing: '-0.01em',  fontWeight: '600' }],
        'title-3':['22px', { lineHeight: '1.25', letterSpacing: '-0.005em', fontWeight: '600' }],
        headline: ['18px', { lineHeight: '1.3',  fontWeight: '600' }],
        body:     ['15px', { lineHeight: '1.5',  fontWeight: '400' }],
        caption:  ['13px', { lineHeight: '1.4',  fontWeight: '400' }],
        footnote: ['12px', { lineHeight: '1.3',  fontWeight: '400' }],
      },

      // -------- Radii --------
      borderRadius: {
        xs: 'var(--radius-xs)',
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        xl: 'var(--radius-xl)',
        DEFAULT: 'var(--radius)',
      },

      // -------- Shadows (soft, Apple-style) --------
      boxShadow: {
        'soft-xs': 'var(--shadow-xs)',
        'soft-sm': 'var(--shadow-sm)',
        'soft':    'var(--shadow-md)',
        'soft-lg': 'var(--shadow-lg)',
        'soft-xl': 'var(--shadow-xl)',
        'glow-brand': 'var(--shadow-glow-brand)',
      },

      // -------- Motion --------
      transitionDuration: {
        instant:  '100ms',
        fast:     '200ms',
        base:     '300ms',
        slow:     '500ms',
        emphasis: '700ms',
      },
      transitionTimingFunction: {
        standard:   'cubic-bezier(0.4, 0, 0.2, 1)',
        decelerate: 'cubic-bezier(0, 0, 0.2, 1)',
        accelerate: 'cubic-bezier(0.4, 0, 1, 1)',
        emphasis:   'cubic-bezier(0.32, 0.72, 0, 1)',
      },

      // -------- Spacing (8pt grid extras) --------
      spacing: {
        18: '4.5rem',  // 72px
        22: '5.5rem',  // 88px
        30: '7.5rem',  // 120px
      },

      // -------- Backdrop blur (glass) --------
      backdropBlur: {
        glass: '20px',
        thick: '40px',
      },

      // -------- Animations (declared via keyframes in globals.css) --------
      animation: {
        'pulse-soft':       'pulse-soft 2s cubic-bezier(0.32, 0.72, 0, 1) infinite',
        'breathing-amber':  'breathing-amber 2s cubic-bezier(0.32, 0.72, 0, 1) infinite',
        'fade-in-up':       'fade-in-up 300ms cubic-bezier(0, 0, 0.2, 1) both',
      },
    },
  },
  plugins: [],
};

export default config;
