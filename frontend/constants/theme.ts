export const theme = {
  colors: {
    ink: '#0F172A',
    slate: '#526175',
    background: '#EAF2F9',
    surface: '#F6FAFF',
    card: 'rgba(255, 255, 255, 0.92)',
    accent: '#0B6E4F',
    accentSoft: '#E0F5F0',
    warning: '#B45309',
    danger: '#B91C1C',
    border: '#DCE5F0',
  },
  radius: {
    sm: 10,
    md: 16,
    lg: 24,
  },
  spacing: {
    xs: 6,
    sm: 10,
    md: 16,
    lg: 24,
    xl: 32,
  },
  font: {
    heading: 'System',
    body: 'System',
  },
};

export type Theme = typeof theme;
