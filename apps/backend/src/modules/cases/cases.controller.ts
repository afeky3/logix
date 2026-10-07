import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { parseBody } from '../../common/http/validate';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import type { AppTokenPayload } from '../../common/auth/jwt-payload';
import { CasesService } from './cases.service';

const openCaseSchema = z.object({
  organizationId: z.string().uuid(),
  caseType: z.enum(['DAMAGE_SHORTAGE', 'GENERAL_SUPPORT']),
  orderReference: z.string().max(40).optional(),
  description: z.string().max(2000).optional(),
  fileIds: z.array(z.string().uuid()).max(10).optional(),
});

/** Buyer-reported issues (client round 1). */
@Controller('cases')
@UseGuards(JwtAuthGuard)
export class CasesController {
  constructor(private readonly cases: CasesService) {}

  @Post()
  open(@Body() body: unknown, @CurrentUser() user: AppTokenPayload) {
    const { organizationId, ...input } = parseBody(openCaseSchema, body);
    return this.cases.open(user.sub, organizationId, input);
  }
}
