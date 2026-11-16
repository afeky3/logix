import { NextResponse } from 'next/server';
import { backendFetch, BackendError } from '../../../../../lib/backend';

/** Public: confirms the deletion with the code. The language travels so a refusal comes back translated. */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const lang = req.headers.get('x-localization') === 'en' ? 'en' : 'ar';
  try {
    return NextResponse.json(
      await backendFetch('/account-deletion/confirm', {
        method: 'POST',
        body: JSON.stringify(body),
        headers: { 'x-localization': lang },
      }),
    );
  } catch (e) {
    if (e instanceof BackendError) return NextResponse.json(e.body, { status: e.status });
    throw e;
  }
}
