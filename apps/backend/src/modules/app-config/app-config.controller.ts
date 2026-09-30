import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * GET /app-config — min app version + feature flags (backend/md/05-api-conventions.md §12).
 * TODO(S0): back feature flags with the sys.feature_flags table once migrated.
 */
@Controller('app-config')
export class AppConfigController {
  constructor(private readonly config: ConfigService) {}

  @Get()
  get() {
    return {
      minVersion: {
        ios: this.config.get<string>('APP_VERSION_MIN_IOS'),
        android: this.config.get<string>('APP_VERSION_MIN_ANDROID'),
      },
      featureFlags: {},
      supportContacts: { email: 'support@logix.sa' },
    };
  }
}
