import { adminGet } from '../../../../lib/admin-proxy';

export async function GET(req: Request) {
  const { search } = new URL(req.url);
  return adminGet(req, `/admin/verification-cases${search}`);
}
