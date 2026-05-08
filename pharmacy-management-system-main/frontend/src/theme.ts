import { Platform } from 'react-native';

export const theme = {
  colors: {
    background: '#eef3fb',
    card: '#ffffff',
    cardAlt: '#f3f8ff',
    cardSoft: '#e7f1ff',
    ink: '#0b1b2a',
    inkMuted: '#334458',
    inkFaded: '#5c6f83',
    accent: '#1e3a8a',
    accentDeep: '#0b1b2a',
    accentCyan: '#4f6fa3',
    accentWarm: '#3f5f8a',
    border: '#c9d7e5',
    borderSoft: '#d9e5f1',
    outline: '#c9d7e5',
    success: '#2f4f7c',
    alert: '#c81e1e',
    warning: '#5a6f8f',
    white: '#ffffff',
    tableHeader: '#dfe9f7',
    rowAlt: '#f5f8fd',
  },
  fonts: {
    heading: Platform.select({ web: '"Space Grotesk", "Segoe UI"', default: 'System' }),
    body: Platform.select({ web: '"Plus Jakarta Sans", "Segoe UI"', default: 'System' }),
  },
};
