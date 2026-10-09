import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { StaffAuthGuard } from '../../common/auth/staff-auth.guard';
import { AdminMarketplaceService } from './admin-marketplace.service';

@Controller('admin/marketplace')
@UseGuards(StaffAuthGuard)
export class AdminMarketplaceController {
  constructor(private readonly svc: AdminMarketplaceService) {}

  @Get()
  list(@Query() q: Record<string, unknown>) {
    return this.svc.list({
      q: q['q'] as string | undefined,
      status: q['status'] as string | undefined,
      limit: Math.min(Number(q['limit'] ?? 100), 200),
      offset: Number(q['offset'] ?? 0),
    });
  }
}
