import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { backendFetch, BackendError } from '../../../../lib/backend';
import { REFRESH_COOKIE, refreshCookieOptions } from '../../../../lib/refresh-cookie';

interface LoginResult {
  accessToken: string;
  refreshToken: string;
  staff: { id: string; email: string; fullName: string };
}

// MFA is switched off for now: a correct password signs straight in.
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  try {
    const result = await backendFetch<LoginResult>('/admin/auth/login', {
      method: 'POST',
      body: JSON.stringify(body),
    });

    const jar = await cookies();
    jar.set(REFRESH_COOKIE, result.refreshToken, refreshCookieOptions());

    // The refresh token never leaves the server — only the access token and profile go to the browser.
    return NextResponse.json({ accessToken: result.accessToken, staff: result.staff });
  } catch (e) {
    if (e instanceof BackendError) return NextResponse.json(e.body, { status: e.status });
    throw e;
  }
}
