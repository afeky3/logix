import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { OrganizationsModule } from '../organizations/organizations.module';
import { FilesController } from './files.controller';
import { FilesService } from './files.service';

@Module({
  // JwtAuthGuard needs JwtService; OrganizationsModule gives KYB queueing.
  imports: [JwtModule.register({}), OrganizationsModule],
  controllers: [FilesController],
  providers: [FilesService],
  exports: [FilesService],
})
export class FilesModule {}
