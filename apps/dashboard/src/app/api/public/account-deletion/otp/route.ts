import { NextResponse } from 'next/server';
import { backendFetch, BackendError } from '../../../../../lib/backend';

/** Public: asks the backend for a deletion code. No sign-in; the backend answers the same for any phone. */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  try {
    return NextResponse.json(await backendFetch('/account-deletion/otp', { method: 'POST', body: JSON.stringify(body) }));
  } catch (e) {
    if (e instanceof BackendError) return NextResponse.json(e.body, { status: e.status });
    throw e;
  }
}
