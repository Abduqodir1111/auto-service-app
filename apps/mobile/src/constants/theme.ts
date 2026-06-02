export const colors = {
  background: '#F4EFE7',
  backgroundAlt: '#FFF9F0',
  card: '#FFFDF9',
  text: '#182120',
  muted: '#6F7E79',
  accent: '#D8682A',
  accentDark: '#A74B16',
  success: '#0C7F64',
  warning: '#D39528',
  danger: '#C95340',
  border: 'rgba(24, 33, 32, 0.12)',
  surfaceNeutral: '#F6F7F8',
  surfaceWarm: '#FFF0E5',
  surfaceWarning: '#FFF7DD',
  surfaceDanger: '#FFF4F0',
  surfaceSuccess: '#EAF4F1',
  borderWarm: '#F1D1BC',
  borderWarning: '#EEDDAB',
  borderDanger: '#E7B5A9',
  borderSuccess: '#D7ECE5',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
};

export const radius = {
  sm: 12,
  md: 16,
  lg: 18,
  xl: 22,
  '2xl': 26,
  pill: 999,
};

export const typography = {
  title: {
    fontSize: 28,
    fontWeight: '800' as const,
    color: colors.text,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800' as const,
    color: colors.text,
  },
  body: {
    fontSize: 15,
    lineHeight: 21,
    color: colors.text,
  },
  muted: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.muted,
  },
  button: {
    fontSize: 15,
    fontWeight: '800' as const,
  },
};
