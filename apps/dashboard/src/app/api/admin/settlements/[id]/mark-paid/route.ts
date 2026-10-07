import { adminPost } from '../../../../../../lib/admin-proxy';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return adminPost(req, `/admin/settlements/${id}/mark-paid`);
}
