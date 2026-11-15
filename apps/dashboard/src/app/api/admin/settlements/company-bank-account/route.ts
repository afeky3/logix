import { adminGet, adminPut } from '../../../../../lib/admin-proxy';

export async function GET(req: Request) {
  return adminGet(req, '/admin/settlements/company-bank-account');
}

export async function PUT(req: Request) {
  return adminPut(req, '/admin/settlements/company-bank-account');
}
