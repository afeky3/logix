import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { parseBody } from '../../common/http/validate';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import type { AppTokenPayload } from '../../common/auth/jwt-payload';
import { OrganizationsService } from './organizations.service';

const createOrgSchema = z.object({
  kind: z.enum(['INDIVIDUAL', 'BUSINESS']),
  displayName: z.string().min(1).max(200),
});

const addWorkspaceSchema = z.object({
  workspace: z.enum(['CUSTOMER', 'SUPPLIER', 'PROVIDER', 'DRIVER']),
  activities: z.array(z.string()).optional(),
});

/** backend/md/modules/02-organizations-kyb-terms.md */
@Controller('organizations')
@UseGuards(JwtAuthGuard)
export class OrganizationsController {
  constructor(private readonly orgs: OrganizationsService) {}

  @Post()
  create(@Body() body: unknown, @CurrentUser() user: AppTokenPayload) {
    const { kind, displayName } = parseBody(createOrgSchema, body);
    return this.orgs.create(user.sub, kind, displayName);
  }

  @Post(':id/workspaces')
  addWorkspace(
    @Param('id') id: string,
    @Body() body: unknown,
    @CurrentUser() user: AppTokenPayload,
  ) {
    const { workspace, activities } = parseBody(addWorkspaceSchema, body);
    return this.orgs.addWorkspace(id, user.sub, workspace, activities);
  }

  @Get(':id/provider-profile')
  getProviderProfile(@Param('id') id: string) {
    return this.orgs.getProviderProfile(id);
  }
}
