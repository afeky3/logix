import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
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

const addServiceAreaSchema = z.object({
  activity: z.enum(['TRANSPORT_CARRIER', 'TRANSPORT_BROKER']),
  areaType: z.enum(['COUNTRY', 'REGION']),
  code: z.string().min(1),
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

  @Get(':id/summary')
  getOrgSummary(@Param('id') id: string, @CurrentUser() user: AppTokenPayload) {
    return this.orgs.getOrgSummary(id, user.sub);
  }

  @Post(':id/service-areas')
  addServiceArea(
    @Param('id') id: string,
    @Body() body: unknown,
    @CurrentUser() user: AppTokenPayload,
  ) {
    const { activity, areaType, code } = parseBody(addServiceAreaSchema, body);
    return this.orgs.addServiceArea(id, user.sub, activity, areaType, code);
  }

  @Get(':id/service-areas')
  listServiceAreas(@Param('id') id: string, @CurrentUser() user: AppTokenPayload) {
    return this.orgs.listServiceAreas(id, user.sub);
  }

  @Delete(':id/service-areas/:areaId')
  removeServiceArea(
    @Param('id') id: string,
    @Param('areaId') areaId: string,
    @CurrentUser() user: AppTokenPayload,
  ) {
    return this.orgs.removeServiceArea(id, user.sub, areaId);
  }
}
