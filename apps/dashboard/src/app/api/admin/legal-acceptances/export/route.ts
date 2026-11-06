import { adminGetFile } from '../../../../../lib/admin-proxy';

/** CSV of the filtered consent log, passed through as-is (BOM, headers). */
export async function GET(req: Request) {
  const { search } = new URL(req.url);
  return adminGetFile(req, `/admin/legal-acceptances/export.csv${search}`);
}
