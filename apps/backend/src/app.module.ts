import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { envSchema } from './common/config/env.schema';
import { PrismaModule } from './infrastructure/prisma/prisma.module';
import { HealthModule } from './modules/health/health.module';
import { AppConfigModule } from './modules/app-config/app-config.module';
import { AuthModule } from './modules/auth/auth.module';
import { OrganizationsModule } from './modules/organizations/organizations.module';
import { FilesModule } from './modules/files/files.module';
import { AdminKybModule } from './modules/admin-kyb/admin-kyb.module';
import { AdminAccountsModule } from './modules/admin-accounts/admin-accounts.module';
import { AdminSettlementsModule } from './modules/admin-settlements/admin-settlements.module';
import { ShippingModule } from './modules/shipping/shipping.module';
import { CasesModule } from './modules/cases/cases.module';
import { AdminCasesModule } from './modules/admin-cases/admin-cases.module';
import { SupplierProductsModule } from './modules/supplier-products/supplier-products.module';
import { RequestsModule } from './modules/requests/requests.module';
import { OrdersModule } from './modules/orders/orders.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: (config) => envSchema.parse(config),
    }),
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.NODE_ENV === 'prod' ? 'info' : 'debug',
        genReqId: (req) => (req.headers['x-request-id'] as string) ?? undefined,
      },
    }),
    PrismaModule,
    HealthModule,
    AppConfigModule,
    AuthModule,
    OrganizationsModule,
    FilesModule,
    AdminKybModule,
    AdminAccountsModule,
    AdminSettlementsModule,
    ShippingModule,
    CasesModule,
    AdminCasesModule,
    SupplierProductsModule,
    RequestsModule,
    OrdersModule,
  ],
})
export class AppModule {}
