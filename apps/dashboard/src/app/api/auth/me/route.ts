import { NextResponse } from 'next/server';
import { backendFetch, BackendError } from '../../../../lib/backend';

export async function GET(req: Request) {
  const accessToken = req.headers.get('authorization')?.replace(/^Bearer /, '');
  if (!accessToken) {
    return NextResponse.json(
      { error: { code: 'UNAUTHENTICATED', message: 'Missing access token' } },
      { status: 401 },
    );
  }
  try {
    const result = await backendFetch('/admin/me', { accessToken });
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof BackendError) return NextResponse.json(e.body, { status: e.status });
    throw e;
  }
}
