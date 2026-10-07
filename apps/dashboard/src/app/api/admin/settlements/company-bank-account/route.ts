import { adminGet } from '../../../../../lib/admin-proxy';

export async function GET(req: Request) {
  return adminGet(req, '/admin/settlements/company-bank-account');
}
