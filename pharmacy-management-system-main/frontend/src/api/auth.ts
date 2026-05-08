import { apiRequest } from './client';

type LoginResponse = {
  token?: string;
  key?: string;
  access?: string;
  role?: string;
  allowed_sections?: string[];
  user?: {
    id?: number;
    username?: string;
    role?: string;
  };
  [key: string]: unknown;
};

export function login(username: string, password: string): Promise<LoginResponse> {
  return apiRequest<LoginResponse>('/login/', {
    method: 'POST',
    body: { username, password },
    omitAuth: true,
  });
}
