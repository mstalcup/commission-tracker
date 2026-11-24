import { getIdToken, signIn } from './auth';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    /** Field-level validation errors from the API, e.g. { title: ['Title is required'] } */
    public fieldErrors?: Record<string, string[]>,
  ) {
    super(message);
  }
}

/** Calls our API (same domain, under /api) with the user's login token attached. */
export async function api<T>(method: string, path: string, body?: unknown): Promise<T> {
  const token = await getIdToken();
  if (!token) {
    await signIn();
    throw new ApiError(401, 'Signing in…');
  }
  const res = await fetch(`/api${path}`, {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401) {
    await signIn();
    throw new ApiError(401, 'Your session expired. Signing in again…');
  }
  const text = await res.text();
  const data = text ? JSON.parse(text) : undefined;
  if (!res.ok) {
    throw new ApiError(res.status, data?.message ?? `Request failed (${res.status})`, data?.details);
  }
  return data as T;
}

export const get = <T>(path: string) => api<T>('GET', path);
export const post = <T>(path: string, body?: unknown) => api<T>('POST', path, body);
export const patch = <T>(path: string, body?: unknown) => api<T>('PATCH', path, body);
export const del = <T>(path: string) => api<T>('DELETE', path);
