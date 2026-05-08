import { API_BASE_URL, API_TOKEN } from './config';

type ApiMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

type ApiOptions = {
  method?: ApiMethod;
  headers?: Record<string, string>;
  body?: unknown;
  omitAuth?: boolean;
};

type ApiError = Error & {
  status?: number;
  data?: unknown;
};

let runtimeToken = API_TOKEN || '';
const SESSION_STORAGE_KEY = 'pharmacy_session_v1';

export function setApiToken(token: string) {
  runtimeToken = token || '';
}

function buildHeaders(extra?: Record<string, string>, omitAuth?: boolean) {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };

  if (!omitAuth && runtimeToken) {
    headers.Authorization = runtimeToken.includes(' ')
      ? runtimeToken
      : `Token ${runtimeToken}`;
  }

  return { ...headers, ...(extra || {}) };
}

export async function apiRequest<T = unknown>(path: string, options: ApiOptions = {}): Promise<T> {
  const method = options.method || 'GET';
  const isReadRequest = method === 'GET';
  const separator = path.includes('?') ? '&' : '?';
  const cacheBust = isReadRequest ? `${separator}_=${Date.now()}` : '';
  const url = `${API_BASE_URL}${path}${cacheBust}`;
  const config: RequestInit = {
    method,
    headers: buildHeaders(options.headers, options.omitAuth),
  };

  if (options.body !== undefined) {
    config.body = JSON.stringify(options.body);
  }

  const response = await fetch(url, config);
  const text = await response.text();
  let data: T | null = null;
  if (text) {
    try {
      data = JSON.parse(text) as T;
    } catch (err) {
      data = null;
    }
  }

  if (!response.ok) {
    if (response.status === 401) {
      runtimeToken = '';
      if (typeof window !== 'undefined' && window.localStorage) {
        try {
          window.localStorage.removeItem(SESSION_STORAGE_KEY);
        } catch {
          // no-op
        }
      }
    }
    const error: ApiError = new Error(`API ${response.status}: ${response.statusText}`);
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data as T;
}
