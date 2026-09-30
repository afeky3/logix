import { proxyToBackend } from '../../../../lib/proxy-to-backend';

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  return proxyToBackend('/admin/auth/mfa/setup', body);
}
