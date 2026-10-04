import { adminGet } from '../../../../../lib/admin-proxy';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return adminGet(req, `/admin/orders/${id}`);
}
