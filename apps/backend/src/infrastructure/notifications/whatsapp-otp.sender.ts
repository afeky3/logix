import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Stand-in OTP delivery channel while T-04 (real SMS provider + sender ID)
 * is still open — see planning/backend/md/12-execution-plan.md §2. Sends the
 * code as a WhatsApp message through a self-hosted Evolution API instance
 * instead of actual SMS. Swap this out for the real SMS adapter once T-04
 * lands; callers only depend on `send(phone, code)`.
 */
@Injectable()
export class WhatsAppOtpSender {
  private readonly logger = new Logger(WhatsAppOtpSender.name);

  constructor(private readonly config: ConfigService) {}

  async send(phoneE164: string, code: string): Promise<void> {
    const baseUrl = this.config.get<string>('EVOLUTION_API_BASE_URL');
    const apiKey = this.config.get<string>('EVOLUTION_API_KEY');
    const instance = this.config.get<string>('EVOLUTION_INSTANCE');
    if (!baseUrl || !apiKey || !instance) {
      throw new Error(
        'Evolution API is not configured (EVOLUTION_API_BASE_URL / EVOLUTION_API_KEY / EVOLUTION_INSTANCE)',
      );
    }

    // Evolution API wants the number without the leading "+".
    const number = phoneE164.replace(/^\+/, '');
    const text = `رمز التحقق الخاص بك في Logix هو: ${code}\nصالح لمدة 5 دقائق. لا تشاركه مع أي شخص.`;

    const res = await fetch(`${baseUrl.replace(/\/+$/, '')}/message/sendText/${instance}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: apiKey },
      body: JSON.stringify({ number, text }),
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Evolution API responded ${res.status}: ${body}`);
    }

    this.logger.log(`[whatsapp] OTP delivered to ${phoneE164}`);
  }
}
