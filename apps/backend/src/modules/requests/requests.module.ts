import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { RequestsController } from './requests.controller';
import { RequestsService } from './requests.service';
import { OpportunitiesController } from './opportunities.controller';
import { OpportunitiesService } from './opportunities.service';
import { QuotesController } from './quotes.controller';
import { QuotesService } from './quotes.service';
import { ReferenceGenerator } from '../../common/references/reference-generator';

@Module({
  imports: [JwtModule.register({})], // JwtAuthGuard needs JwtService
  controllers: [RequestsController, OpportunitiesController, QuotesController],
  providers: [RequestsService, OpportunitiesService, QuotesService, ReferenceGenerator],
})
export class RequestsModule {}
