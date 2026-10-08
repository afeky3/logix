import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { OrgMembersController } from './org-members.controller';
import { OrgMembersService } from './org-members.service';

@Module({
  imports: [JwtModule.register({})],
  controllers: [OrgMembersController],
  providers: [OrgMembersService],
})
export class OrgMembersModule {}
