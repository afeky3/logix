/** Server-side only: calls the Logix backend API. Never import this from a
 * client component — `BACKEND_URL` is not exposed to the browser, and every
 * dashboard→backend call goes through a Next.js route handler instead
 * (planning/web_dashboard/md/02-architecture.md §2). */
const BACKEND_URL = process.env.BACKEND_URL ?? 'http://127.0.0.1:3001/api/v1';

export interface BackendErrorBody {
  error: { code: string; message: string; requestId?: string; retryable?: boolean };
}

export class BackendError extends Error {
  constructor(
    readonly status: number,
    readonly body: BackendErrorBody,
  ) {
    super(body.error?.message ?? 'Backend request failed');
  }
}

export async function backendFetch<T>(
  path: string,
  init?: RequestInit & { accessToken?: string },
): Promise<T> {
  const { accessToken, headers, ...rest } = init ?? {};
  const res = await fetch(`${BACKEND_URL}${path}`, {
    ...rest,
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...headers,
    },
    cache: 'no-store',
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new BackendError(res.status, body as BackendErrorBody);
  return body as T;
}
