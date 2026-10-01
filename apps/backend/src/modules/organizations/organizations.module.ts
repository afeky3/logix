import { Module } from '@nestjs/common';
import { OrganizationsController } from './organizations.controller';
import { OrganizationsService } from './organizations.service';
import { TermsController } from './terms.controller';
import { TermsService } from './terms.service';

@Module({
  controllers: [OrganizationsController, TermsController],
  providers: [OrganizationsService, TermsService],
})
export class OrganizationsModule {}
