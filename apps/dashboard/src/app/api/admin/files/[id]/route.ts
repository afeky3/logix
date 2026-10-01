import { adminGetFile } from '../../../../../lib/admin-proxy';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return adminGetFile(req, `/admin/files/${id}`);
}
