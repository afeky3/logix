import { adminPost } from '../../../../../../../../lib/admin-proxy';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; itemId: string }> },
) {
  const { id, itemId } = await params;
  return adminPost(req, `/admin/verification-cases/${id}/items/${itemId}/decision`);
}
