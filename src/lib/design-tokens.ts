export const designTokens = {
  colors: {
    // CivicChain brand - deep trust blue with amber accent
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
      950: '#172554',
    },
    accent: {
      50: '#fffbeb',
      100: '#fef3c7',
      200: '#fde68a',
      300: '#fcd34d',
      400: '#fbbf24',
      500: '#f59e0b',
      600: '#d97706',
      700: '#b45309',
      800: '#92400e',
      900: '#78350f',
    },
    // Semantic colors
    success: {
      light: '#22c55e',
      DEFAULT: '#16a34a',
      dark: '#15803d',
    },
    warning: {
      light: '#fbbf24',
      DEFAULT: '#f59e0b',
      dark: '#d97706',
    },
    danger: {
      light: '#f87171',
      DEFAULT: '#ef4444',
      dark: '#dc2626',
    },
    // Status colors
    status: {
      active: '#3b82f6',
      assigned: '#8b5cf6',
      promised: '#06b6d4',
      onTrack: '#22c55e',
      atRisk: '#f59e0b',
      verificationPending: '#8b5cf6',
      resolved: '#16a34a',
      partiallyResolved: '#f59e0b',
      brokenPromise: '#ef4444',
    },
    // Neutral - warm gray tinted to brand
    neutral: {
      50: '#fafafa',
      100: '#f4f4f5',
      200: '#e4e4e7',
      300: '#d4d4d8',
      400: '#a1a1aa',
      500: '#71717a',
      600: '#52525b',
      700: '#3f3f46',
      800: '#27272a',
      900: '#18181b',
      950: '#09090b',
    },
    // Dark mode - tinted to brand blue
    dark: {
      bg: '#0a0f1a',
      bgElevated: '#111827',
      bgCard: '#151d30',
      border: '#1e293b',
      borderHover: '#334155',
    },
  },

  typography: {
    // Display: distinctive serif for authority/trust
    display: {
      fontFamily: '"Playfair Display", Georgia, serif',
      fontWeight: {
        normal: 400,
        medium: 500,
        semibold: 600,
        bold: 700,
      },
      lineHeight: {
        tight: 1.1,
        snug: 1.2,
        normal: 1.3,
      },
      letterSpacing: {
        tight: '-0.04em',
        normal: '-0.02em',
      },
    },
    // Body: clean, readable sans
    body: {
      fontFamily: '"DM Sans", system-ui, -apple-system, sans-serif',
      fontWeight: {
        light: 300,
        normal: 400,
        medium: 500,
        semibold: 600,
        bold: 700,
      },
      lineHeight: {
        tight: 1.4,
        normal: 1.6,
        relaxed: 1.75,
      },
      letterSpacing: {
        tight: '-0.01em',
        normal: '0',
        wide: '0.01em',
      },
    },
    // Mono: for data, codes, technical
    mono: {
      fontFamily: '"JetBrains Mono", "Fira Code", monospace',
      fontWeight: {
        normal: 400,
        medium: 500,
      },
    },
    // Scale ratio 1.25
    scale: {
      xs: '0.75rem',    // 12px
      sm: '0.875rem',   // 14px
      base: '1rem',     // 16px
      lg: '1.125rem',   // 18px
      xl: '1.25rem',    // 20px
      '2xl': '1.563rem', // 25px
      '3xl': '1.953rem', // 31px
      '4xl': '2.441rem', // 39px
      '5xl': '3.052rem', // 49px
      '6xl': '3.815rem', // 61px
      '7xl': '4.768rem', // 76px
    },
  },

  spacing: {
    // 4px base grid
    0: '0',
    1: '0.25rem',   // 4px
    2: '0.5rem',    // 8px
    3: '0.75rem',   // 12px
    4: '1rem',      // 16px
    5: '1.25rem',   // 20px
    6: '1.5rem',    // 24px
    7: '1.75rem',   // 28px
    8: '2rem',      // 32px
    10: '2.5rem',   // 40px
    12: '3rem',     // 48px
    14: '3.5rem',   // 56px
    16: '4rem',     // 64px
    20: '5rem',     // 80px
    24: '6rem',     // 96px
    28: '7rem',     // 112px
    32: '8rem',     // 128px
    36: '9rem',     // 144px
    40: '10rem',    // 160px
    48: '12rem',    // 192px
    56: '14rem',    // 224px
    64: '16rem',    // 256px
  },

  radius: {
    none: '0',
    sm: '0.25rem',   // 4px
    DEFAULT: '0.5rem', // 8px
    md: '0.75rem',   // 12px
    lg: '1rem',      // 16px
    xl: '1.5rem',    // 24px
    '2xl': '2rem',   // 32px
    full: '9999px',
  },

  shadows: {
    // Elevation by lightness, not glow
    xs: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
    sm: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
    DEFAULT: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
    md: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
    lg: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
    xl: '0 25px 50px -12px rgb(0 0 0 / 0.25)',
    '2xl': '0 35px 60px -15px rgb(0 0 0 / 0.3)',
    inner: 'inset 0 2px 4px 0 rgb(0 0 0 / 0.05)',
    // Dark mode shadows
    dark: {
      sm: '0 1px 3px 0 rgb(0 0 0 / 0.3), 0 1px 2px -1px rgb(0 0 0 / 0.3)',
      DEFAULT: '0 4px 6px -1px rgb(0 0 0 / 0.4), 0 2px 4px -2px rgb(0 0 0 / 0.3)',
      md: '0 10px 15px -3px rgb(0 0 0 / 0.4), 0 4px 6px -4px rgb(0 0 0 / 0.3)',
      lg: '0 20px 25px -5px rgb(0 0 0 / 0.4), 0 8px 10px -6px rgb(0 0 0 / 0.3)',
      xl: '0 25px 50px -12px rgb(0 0 0 / 0.5)',
    },
  },

  transitions: {
    fast: '150ms cubic-bezier(0.4, 0, 0.2, 1)',
    DEFAULT: '200ms cubic-bezier(0.4, 0, 0.2, 1)',
    slow: '300ms cubic-bezier(0.4, 0, 0.2, 1)',
    slower: '500ms cubic-bezier(0.4, 0, 0.2, 1)',
    // Spring for natural motion
    spring: '400ms cubic-bezier(0.34, 1.56, 0.64, 1)',
    springGentle: '600ms cubic-bezier(0.34, 1.56, 0.64, 1)',
  },

  breakpoints: {
    sm: '640px',
    md: '768px',
    lg: '1024px',
    xl: '1280px',
    '2xl': '1536px',
  },

  container: {
    maxWidth: '1400px',
    padding: {
      DEFAULT: '1.5rem',
      sm: '2rem',
      lg: '3rem',
      xl: '4rem',
    },
  },

  zIndex: {
    dropdown: 100,
    sticky: 200,
    fixed: 300,
    modalBackdrop: 400,
    modal: 500,
    popover: 600,
    tooltip: 700,
    toast: 800,
  },
} as const;

export type DesignTokens = typeof designTokens;