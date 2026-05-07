const DEFAULT_API_BASE_URL = 'http://127.0.0.1:8001';

const configuredBase =
  (typeof process !== 'undefined' ? process.env.EXPO_PUBLIC_API_BASE_URL : undefined) ||
  DEFAULT_API_BASE_URL;

export const API_BASE_URL = configuredBase.replace(/\/+$/, '');

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

type ApiRequestOptions = {
  method?: HttpMethod;
  body?: unknown;
  headers?: Record<string, string>;
};

const UNSAFE_METHODS = new Set<HttpMethod>(['POST', 'PUT', 'PATCH', 'DELETE']);

function buildUrl(path: string) {
  if (/^https?:\/\//i.test(path)) return path;
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE_URL}${normalized}`;
}

function readCookie(name: string) {
  if (typeof document === 'undefined') return '';
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : '';
}

async function ensureCsrfCookie() {
  await fetch(buildUrl('/api/v1/auth/csrf'), {
    method: 'GET',
    credentials: 'include',
  });
}

export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const method = options.method ?? 'GET';
  const hasBody = options.body !== undefined;
  const headers: Record<string, string> = {
    ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
    ...(options.headers ?? {}),
  };

  if (UNSAFE_METHODS.has(method) && !headers['X-CSRFToken']) {
    let token = readCookie('csrftoken');
    if (!token) {
      await ensureCsrfCookie();
      token = readCookie('csrftoken');
    }
    if (token) {
      headers['X-CSRFToken'] = token;
    }
  }

  const response = await fetch(buildUrl(path), {
    method,
    credentials: 'include',
    headers,
    body: hasBody ? JSON.stringify(options.body) : undefined,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`API ${method} ${path} failed (${response.status}): ${text || response.statusText}`);
  }

  if (response.status === 204) {
    return null as T;
  }

  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    return (await response.json()) as T;
  }
  return (await response.text()) as T;
}

export function toIsoDateOnly(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
