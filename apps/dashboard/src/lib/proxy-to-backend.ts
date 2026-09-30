import { NextResponse } from 'next/server';
import { backendFetch, BackendError } from './backend';

/** POSTs `body` to the backend and forwards the result (or its error
 * envelope) as a NextResponse. Used by the api/auth/* route handlers. */
export async function proxyToBackend(
  path: string,
  body: unknown,
  accessToken?: string,
): Promise<NextResponse> {
  try {
    const result = await backendFetch(path, {
      method: 'POST',
      body: JSON.stringify(body ?? {}),
      accessToken,
    });
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof BackendError) return NextResponse.json(e.body, { status: e.status });
    throw e;
  }
}
