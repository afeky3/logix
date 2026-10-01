import { NextResponse } from 'next/server';
import { backendFetch, BackendError } from './backend';

/** Shared plumbing for the `/api/admin/*` route handlers: every one reads
 * the staff access token from the incoming `Authorization` header (the
 * client holds it in memory, see auth-context.tsx) and forwards a JSON
 * call to the backend, translating `BackendError` into the same envelope
 * the backend would have sent directly. */

function getAccessToken(req: Request): string | null {
  return req.headers.get('authorization')?.replace(/^Bearer /, '') ?? null;
}

function unauthorized() {
  return NextResponse.json(
    { error: { code: 'UNAUTHENTICATED', message: 'Missing access token' } },
    { status: 401 },
  );
}

function fromBackendError(e: unknown): NextResponse {
  if (e instanceof BackendError) return NextResponse.json(e.body, { status: e.status });
  throw e;
}

export async function adminGet(req: Request, path: string): Promise<NextResponse> {
  const accessToken = getAccessToken(req);
  if (!accessToken) return unauthorized();
  try {
    return NextResponse.json(await backendFetch(path, { accessToken }));
  } catch (e) {
    return fromBackendError(e);
  }
}

export async function adminPost(req: Request, path: string): Promise<NextResponse> {
  const accessToken = getAccessToken(req);
  if (!accessToken) return unauthorized();
  const body = await req.json().catch(() => ({}));
  try {
    return NextResponse.json(
      await backendFetch(path, { method: 'POST', body: JSON.stringify(body), accessToken }),
    );
  } catch (e) {
    return fromBackendError(e);
  }
}

/** Binary passthrough for GET /admin/files/:id — backendFetch assumes
 * JSON, so this one talks to the backend directly. */
export async function adminGetFile(req: Request, path: string): Promise<NextResponse> {
  const accessToken = getAccessToken(req);
  if (!accessToken) return unauthorized();

  const backendUrl = process.env.BACKEND_URL ?? 'http://127.0.0.1:3001/api/v1';
  const res = await fetch(`${backendUrl}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: { code: 'UNKNOWN', message: 'Request failed' } }));
    return NextResponse.json(body, { status: res.status });
  }

  const buffer = await res.arrayBuffer();
  return new NextResponse(buffer, {
    headers: {
      'Content-Type': res.headers.get('content-type') ?? 'application/octet-stream',
      'Content-Disposition': res.headers.get('content-disposition') ?? 'attachment',
      'Cache-Control': 'private, no-store',
    },
  });
}
