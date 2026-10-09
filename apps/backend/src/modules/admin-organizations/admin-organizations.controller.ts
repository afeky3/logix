import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { parseBody } from '../../common/http/validate';
import { StaffAuthGuard } from '../../common/auth/staff-auth.guard';
import { AdminOrganizationsService } from './admin-organizations.service';

const listQuery = z.object({
  q: z.string().max(100).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

@Controller('admin/organizations')
@UseGuards(StaffAuthGuard)
export class AdminOrganizationsController {
  constructor(private readonly orgs: AdminOrganizationsService) {}

  @Get()
  list(@Query() query: Record<string, unknown>) {
    return this.orgs.list(parseBody(listQuery, query));
  }

  @Get(':id/members')
  listMembers(@Param('id') id: string) {
    return this.orgs.listMembers(id);
  }
}
