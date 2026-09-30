import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { backendFetch } from '../../../../lib/backend';
import { REFRESH_COOKIE } from '../../../../lib/refresh-cookie';

export async function POST(req: Request) {
  const accessToken = req.headers.get('authorization')?.replace(/^Bearer /, '');
  if (accessToken) {
    // Best-effort: revoke the session server-side. Cookie is cleared either way.
    await backendFetch('/admin/auth/logout', { method: 'POST', body: '{}', accessToken }).catch(
      () => undefined,
    );
  }
  const jar = await cookies();
  jar.delete(REFRESH_COOKIE);
  return NextResponse.json({ success: true });
}
