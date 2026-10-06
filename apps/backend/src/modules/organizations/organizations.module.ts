import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { OrganizationsController } from './organizations.controller';
import { OrganizationsService } from './organizations.service';
import { TermsController } from './terms.controller';
import { TermsService } from './terms.service';
import { KybController } from './kyb.controller';
import { KybService } from './kyb.service';

@Module({
  imports: [JwtModule.register({})], // JwtAuthGuard needs JwtService; secret passed per call
  controllers: [OrganizationsController, TermsController, KybController],
  providers: [OrganizationsService, TermsService, KybService],
  exports: [KybService],
})
export class OrganizationsModule {}
