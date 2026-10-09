import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AdminOrganizationsController } from './admin-organizations.controller';
import { AdminOrganizationsService } from './admin-organizations.service';

@Module({
  imports: [JwtModule.register({})],
  controllers: [AdminOrganizationsController],
  providers: [AdminOrganizationsService],
})
export class AdminOrganizationsModule {}
