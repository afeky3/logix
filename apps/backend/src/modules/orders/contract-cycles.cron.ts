import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ContractsService } from './contracts.service';

/** Opens each month's cycle, marks missed payments overdue, settles finished months. Worker-only. */
@Injectable()
export class ContractCyclesCron {
  constructor(private readonly contracts: ContractsService) {}

  @Cron(CronExpression.EVERY_HOUR)
  async run(): Promise<void> {
    await this.contracts.sweep();
  }
}
