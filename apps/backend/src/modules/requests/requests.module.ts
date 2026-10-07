import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { RequestsController } from './requests.controller';
import { RequestsService } from './requests.service';
import { OpportunitiesController } from './opportunities.controller';
import { OpportunitiesService } from './opportunities.service';
import { QuotesController } from './quotes.controller';
import { QuotesService } from './quotes.service';
import { AdminRequestsController } from './admin-requests.controller';
import { AdminRequestsService } from './admin-requests.service';
import { ReferenceGenerator } from '../../common/references/reference-generator';
import { OsmMapsAdapter } from '../../infrastructure/maps/osm-maps.adapter';
import { CustomsModule } from '../customs/customs.module';
import { StorageModule } from '../storage/storage.module';
import { ShippingModule } from '../shipping/shipping.module';

@Module({
  imports: [JwtModule.register({}), CustomsModule, StorageModule, ShippingModule], // JwtAuthGuard/StaffAuthGuard need JwtService
  controllers: [
    RequestsController,
    OpportunitiesController,
    QuotesController,
    AdminRequestsController,
  ],
  providers: [
    RequestsService,
    OpportunitiesService,
    QuotesService,
    AdminRequestsService,
    ReferenceGenerator,
    OsmMapsAdapter,
  ],
})
export class RequestsModule {}
