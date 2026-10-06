import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { parseBody } from '../../common/http/validate';
import { StaffAuthGuard } from '../../common/auth/staff-auth.guard';
import { AdminAccountsService } from './admin-accounts.service';

const listQuery = z.object({
  q: z.string().max(100).optional(),
  status: z.enum(['ACTIVE', 'SUSPENDED']).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  offset: z.coerce.number().int().min(0).default(0),
});

const statusSchema = z.object({ status: z.enum(['ACTIVE', 'SUSPENDED']) });

/** Staff console: app accounts. Staff-only (`aud: "staff"`). */
@Controller('admin/accounts')
@UseGuards(StaffAuthGuard)
export class AdminAccountsController {
  constructor(private readonly accounts: AdminAccountsService) {}

  @Get()
  list(@Query() query: Record<string, unknown>) {
    return this.accounts.list(parseBody(listQuery, query));
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.accounts.get(id);
  }

  @Post(':id/status')
  setStatus(@Param('id') id: string, @Body() body: unknown) {
    return this.accounts.setStatus(id, parseBody(statusSchema, body).status);
  }
}
