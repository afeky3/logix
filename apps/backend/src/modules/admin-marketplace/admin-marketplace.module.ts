import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AdminMarketplaceController } from './admin-marketplace.controller';
import { AdminMarketplaceService } from './admin-marketplace.service';

@Module({
  imports: [JwtModule.register({})],
  controllers: [AdminMarketplaceController],
  providers: [AdminMarketplaceService],
})
export class AdminMarketplaceModule {}
