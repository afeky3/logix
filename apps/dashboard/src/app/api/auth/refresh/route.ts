import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { backendFetch, BackendError } from '../../../../lib/backend';
import { REFRESH_COOKIE, refreshCookieOptions } from '../../../../lib/refresh-cookie';

interface RefreshResult {
  accessToken: string;
  refreshToken: string;
}

/** Silent refresh, called on app load using the HttpOnly cookie — the
 * browser never sees the refresh token itself. */
export async function POST() {
  const jar = await cookies();
  const refreshToken = jar.get(REFRESH_COOKIE)?.value;
  if (!refreshToken) {
    return NextResponse.json(
      { error: { code: 'UNAUTHENTICATED', message: 'No session' } },
      { status: 401 },
    );
  }

  try {
    const result = await backendFetch<RefreshResult>('/admin/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    });
    jar.set(REFRESH_COOKIE, result.refreshToken, refreshCookieOptions());
    return NextResponse.json({ accessToken: result.accessToken });
  } catch (e) {
    jar.delete(REFRESH_COOKIE);
    if (e instanceof BackendError) return NextResponse.json(e.body, { status: e.status });
    throw e;
  }
}
