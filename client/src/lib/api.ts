import type { AppUser } from './types';

export class ApiError extends Error {
  status: number;
  offline: boolean;

  constructor(message: string, status = 0, offline = false) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.offline = offline;
  }
}

type AuthResponse = {
  user: AppUser;
  vaultSalt: string;
};

type PullResponse = {
  records: Array<{
    seq: number;
    entity: string;
    id: string;
    payload: string;
    updatedAt: number;
  }>;
  cursor: number;
  hasMore: boolean;
};

const BASE = `${import.meta.env.VITE_API_URL ?? ''}/api`;

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body !== undefined && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  let response: Response;
  try {
    response = await fetch(`${BASE}${path}`, {
      ...init,
      credentials: 'include',
      headers,
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    throw new ApiError('Sem conexão com o servidor.', 0, true);
  }

  let payload: unknown = null;
  const text = await response.text();
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = null;
    }
  }

  if (!response.ok) {
    const message =
      payload && typeof payload === 'object' && 'error' in payload
        ? String((payload as { error: unknown }).error)
        : 'Não foi possível concluir a solicitação.';
    throw new ApiError(message, response.status, false);
  }

  return payload as T;
}

export const api = {
  register(username: string, pin: string): Promise<AuthResponse> {
    return request<AuthResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, pin }),
    });
  },

  login(username: string, pin: string): Promise<AuthResponse> {
    return request<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, pin }),
    });
  },

  me(): Promise<AuthResponse> {
    return request<AuthResponse>('/auth/me');
  },

  logout(): Promise<{ ok: boolean }> {
    return request<{ ok: boolean }>('/auth/logout', {
      method: 'POST',
      body: JSON.stringify({}),
    });
  },

  pull(since: number, limit = 400): Promise<PullResponse> {
    return request<PullResponse>(`/sync/pull?since=${since}&limit=${limit}`);
  },

  push(
    records: Array<{ entity: string; id: string; updatedAt: number; payload: string }>,
  ): Promise<{ ok: boolean; accepted: number }> {
    return request<{ ok: boolean; accepted: number }>('/sync/push', {
      method: 'POST',
      body: JSON.stringify({ records }),
    });
  },
};
