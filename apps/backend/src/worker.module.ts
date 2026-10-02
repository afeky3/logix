import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from './infrastructure/prisma/prisma.module';
import { RequestExpiryService } from './modules/requests/request-expiry.service';

/**
 * Cron jobs live here, not in AppModule — AppModule is bootstrapped by
 * both main.ts (API) and worker.ts; putting @Cron providers in it would
 * run every job twice (once per process). worker.ts bootstraps this
 * module instead, alongside AppModule for the HTTP-facing API.
 */
@Module({
  imports: [ScheduleModule.forRoot(), PrismaModule],
  providers: [RequestExpiryService],
})
export class WorkerModule {}
