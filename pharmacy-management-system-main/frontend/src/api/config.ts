function resolveDefaultApiBaseUrl() {
  if (typeof window !== 'undefined' && window.location?.hostname) {
    const host = window.location.hostname;
    return `http://${host}:8001`;
  }
  return 'http://localhost:8001';
}

const rawApiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL || resolveDefaultApiBaseUrl();

export const API_BASE_URL: string = rawApiBaseUrl.trim().replace(/\/+$/, '');

export const API_TOKEN: string = process.env.EXPO_PUBLIC_API_TOKEN || '';
