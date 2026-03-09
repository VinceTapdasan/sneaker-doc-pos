import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

// Semaphore SMS service — https://semaphore.co/docs
// Set SMS_ENABLED=true in .env and add your SEMAPHORE_API_KEY to activate.
// Until then, all send() calls are logged stubs only.

interface SendSmsParams {
  to: string;
  message: string;
}

interface SemaphoreResponse {
  message_id: number;
  user_id: number;
  user: string;
  account_id: number;
  account: string;
  recipient: string;
  message: string;
  sender_name: string;
  network: string;
  status: string;
  type: string;
  source: string;
  created_at: string;
  updated_at: string;
}

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);
  private readonly enabled: boolean;
  private readonly apiKey: string;
  private readonly senderName: string;

  constructor(private readonly config: ConfigService) {
    this.enabled = this.config.get<string>('SMS_ENABLED') === 'true';
    this.apiKey = this.config.get<string>('SEMAPHORE_API_KEY') ?? '';
    this.senderName = this.config.get<string>('SEMAPHORE_SENDER_NAME') ?? 'SneakerDoc';
  }

  // Normalize PH mobile numbers to 09XXXXXXXXX format expected by Semaphore.
  // Accepts: +639XXXXXXXXX, 639XXXXXXXXX, 09XXXXXXXXX
  private normalizeNumber(number: string): string {
    const digits = number.replace(/\D/g, '');
    if (digits.startsWith('63') && digits.length === 12) {
      return '0' + digits.slice(2);
    }
    return digits;
  }

  async sendScheduleChangedSms(txn: {
    customerPhone: string;
    customerName?: string | null;
    number: string;
    newPickupDate?: string | null;
  }): Promise<void> {
    const name = txn.customerName ?? 'Customer';
    const dateStr = txn.newPickupDate
      ? new Date(txn.newPickupDate).toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' })
      : null;
    const message = [
      `Hi ${name}! Your pickup for Transaction #${txn.number} has been rescheduled.`,
      ...(dateStr ? [`New pickup date: ${dateStr}.`] : []),
      `See you then!`,
    ].join(' ');
    await this.send({ to: txn.customerPhone, message });
  }

  async send(params: SendSmsParams): Promise<void> {
    const recipient = this.normalizeNumber(params.to);

    if (!this.enabled) {
      this.logger.log(
        `[SMS STUB] To: ${recipient} | Message: ${params.message}`,
      );
      return;
    }

    if (!this.apiKey) {
      this.logger.warn('SMS_ENABLED is true but SEMAPHORE_API_KEY is not set. Skipping send.');
      return;
    }

    const body = new URLSearchParams({
      apikey: this.apiKey,
      number: recipient,
      message: params.message,
      sendername: this.senderName,
    });

    const res = await fetch('https://api.semaphore.co/api/v4/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (!res.ok) {
      const text = await res.text();
      this.logger.error(`Semaphore send failed: ${res.status} — ${text}`);
      return;
    }

    const data = (await res.json()) as SemaphoreResponse[];
    this.logger.log(
      `SMS sent to ${recipient} | message_id: ${data[0]?.message_id} | status: ${data[0]?.status}`,
    );
  }
}
