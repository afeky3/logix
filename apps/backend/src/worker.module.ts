import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from './infrastructure/prisma/prisma.module';
import { RequestExpiryService } from './modules/requests/request-expiry.service';
import { PaymentExpiryService } from './modules/orders/payment-expiry.service';
import { AutoReceiptService } from './modules/orders/auto-receipt.service';
import { ContractCyclesCron } from './modules/orders/contract-cycles.cron';
import { ContractsService } from './modules/orders/contracts.service';
import { InvoicesService } from './modules/orders/invoices.service';
import { ReferenceGenerator } from './common/references/reference-generator';

/**
 * Cron jobs live here, not in AppModule — AppModule is bootstrapped by
 * both main.ts (API) and worker.ts; putting @Cron providers in it would
 * run every job twice (once per process). worker.ts bootstraps this
 * module instead, alongside AppModule for the HTTP-facing API.
 */
@Module({
  imports: [ScheduleModule.forRoot(), PrismaModule],
  providers: [
    RequestExpiryService,
    PaymentExpiryService,
    AutoReceiptService,
    ReferenceGenerator,
    InvoicesService,
    ContractsService,
    ContractCyclesCron,
  ],
})
export class WorkerModule {}
