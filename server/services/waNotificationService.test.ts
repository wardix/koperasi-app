import { describe, it, expect, beforeEach, afterEach, mock } from 'bun:test';
import {
  getWaNotificationConfig,
  getAppBaseUrl,
  formatRupiah,
  sendWaNotification,
  sendWaTestMessage,
  notifyEwaRequest,
  notifySavingsWithdrawal,
  notifySavingsDeposit,
  notifyLoanApplication,
} from './waNotificationService';

describe('WhatsApp Notification Service', () => {
  const originalFetch = globalThis.fetch;
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Reset env vars for consistent testing
    delete process.env.WA_NOTIFICATION_ENABLED;
    delete process.env.WA_WEBHOOK_URL;
    delete process.env.WA_WEBHOOK_TOKEN;
    delete process.env.WA_NOTIFICATION_TARGET;
    delete process.env.APP_URL;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    process.env = { ...originalEnv };
  });

  describe('formatRupiah', () => {
    it('formats numbers into Indonesian Rupiah format', () => {
      expect(formatRupiah(500000)).toBe('Rp 500.000');
      expect(formatRupiah(1250000)).toBe('Rp 1.250.000');
      expect(formatRupiah(0)).toBe('Rp 0');
    });
  });

  describe('getAppBaseUrl', () => {
    it('returns APP_URL if set, removing trailing slash', () => {
      process.env.APP_URL = 'https://app.example.com/';
      expect(getAppBaseUrl()).toBe('https://app.example.com');
    });

    it('falls back to VITE_API_URL', () => {
      delete process.env.APP_URL;
      process.env.VITE_API_URL = 'https://api.example.com';
      expect(getAppBaseUrl()).toBe('https://api.example.com');
    });

    it('falls back to first entry in CORS_ORIGIN', () => {
      delete process.env.APP_URL;
      delete process.env.VITE_API_URL;
      process.env.CORS_ORIGIN = 'https://origin1.example.com,https://origin2.example.com';
      expect(getAppBaseUrl()).toBe('https://origin1.example.com');
    });

    it('returns empty string if no relevant env var is set', () => {
      delete process.env.APP_URL;
      delete process.env.VITE_API_URL;
      delete process.env.CORS_ORIGIN;
      expect(getAppBaseUrl()).toBe('');
    });
  });

  describe('getWaNotificationConfig', () => {
    it('loads settings from database mock', async () => {
      const mockDb: any = {
        query: () => ({
          all: async () => [
            { key: 'waNotificationEnabled', value: 'true' },
            { key: 'waWebhookUrl', value: 'https://gateway.mock/v2/messages' },
            { key: 'waWebhookToken', value: 'mock-secret-token' },
            { key: 'waNotificationTarget', value: '628999999999' },
          ],
        }),
      };

      const config = await getWaNotificationConfig(mockDb);
      expect(config.enabled).toBe(true);
      expect(config.webhookUrl).toBe('https://gateway.mock/v2/messages');
      expect(config.token).toBe('mock-secret-token');
      expect(config.target).toBe('628999999999');
    });

    it('falls back to process.env if database does not have keys', async () => {
      process.env.WA_NOTIFICATION_ENABLED = 'true';
      process.env.WA_WEBHOOK_URL = 'https://env-gateway.mock/messages';
      process.env.WA_WEBHOOK_TOKEN = 'env-token-xyz';
      process.env.WA_NOTIFICATION_TARGET = '628111111111';

      const mockEmptyDb: any = {
        query: () => ({
          all: async () => [],
        }),
      };

      const config = await getWaNotificationConfig(mockEmptyDb);
      expect(config.enabled).toBe(true);
      expect(config.webhookUrl).toBe('https://env-gateway.mock/messages');
      expect(config.token).toBe('env-token-xyz');
      expect(config.target).toBe('628111111111');
    });
  });

  describe('sendWaNotification', () => {
    it('sends POST request with bearer token and json body', async () => {
      let capturedUrl = '';
      let capturedOptions: any = null;

      globalThis.fetch = (async (url: string, opts: any) => {
        capturedUrl = url;
        capturedOptions = opts;
        return new Response(JSON.stringify({ success: true }), { status: 200 });
      }) as any;

      const mockDb: any = {
        query: () => ({
          all: async () => [
            { key: 'waNotificationEnabled', value: 'true' },
            { key: 'waWebhookUrl', value: 'https://gateway.mock/messages' },
            { key: 'waWebhookToken', value: 'token-abc' },
            { key: 'waNotificationTarget', value: '628123456789' },
          ],
        }),
      };

      const result = await sendWaNotification('Test message from unit test', { db: mockDb });
      expect(result).toBe(true);
      expect(capturedUrl).toBe('https://gateway.mock/messages');
      expect(capturedOptions.method).toBe('POST');
      expect(capturedOptions.headers['Authorization']).toBe('Bearer token-abc');
      expect(capturedOptions.headers['Content-Type']).toBe('application/json');

      const body = JSON.parse(capturedOptions.body);
      expect(body.to).toBe('628123456789');
      expect(body.body).toBe('text');
      expect(body.text).toBe('Test message from unit test');
    });

    it('returns false and does not throw when fetch rejects (fire-and-forget)', async () => {
      globalThis.fetch = (async () => {
        throw new Error('Connection refused');
      }) as any;

      const mockDb: any = {
        query: () => ({
          all: async () => [
            { key: 'waNotificationEnabled', value: 'true' },
            { key: 'waWebhookUrl', value: 'https://broken.gateway' },
            { key: 'waNotificationTarget', value: '628123456789' },
          ],
        }),
      };

      const result = await sendWaNotification('Should not crash', { db: mockDb });
      expect(result).toBe(false);
    });

    it('does not send if disabled', async () => {
      let called = false;
      globalThis.fetch = (async () => {
        called = true;
        return new Response('ok');
      }) as any;

      const mockDb: any = {
        query: () => ({
          all: async () => [
            { key: 'waNotificationEnabled', value: 'false' },
            { key: 'waWebhookUrl', value: 'https://gateway.mock' },
            { key: 'waNotificationTarget', value: '628123456789' },
          ],
        }),
      };

      const result = await sendWaNotification('Disabled test', { db: mockDb });
      expect(result).toBe(false);
      expect(called).toBe(false);
    });
  });

  describe('sendWaTestMessage', () => {
    it('returns failure when webhookUrl is missing', async () => {
      const mockDb: any = {
        query: () => ({ all: async () => [] }),
      };
      const result = await sendWaTestMessage({ db: mockDb, target: '628123456789' });
      expect(result.success).toBe(false);
      expect(result.message).toContain('URL webhook belum dikonfigurasi');
    });

    it('returns failure when target is missing', async () => {
      const mockDb: any = {
        query: () => ({ all: async () => [] }),
      };
      const result = await sendWaTestMessage({ db: mockDb, webhookUrl: 'https://mock.url' });
      expect(result.success).toBe(false);
      expect(result.message).toContain('Nomor WhatsApp tujuan belum dikonfigurasi');
    });

    it('returns success on 200 response from gateway', async () => {
      globalThis.fetch = (async () => {
        return new Response(JSON.stringify({ status: 'sent' }), { status: 200 });
      }) as any;

      const result = await sendWaTestMessage({
        webhookUrl: 'https://gateway.mock/messages',
        target: '628123456789',
        token: 'test-token',
      });
      expect(result.success).toBe(true);
      expect(result.message).toContain('berhasil');
    });
  });

  describe('Triggers', () => {
    it('notifyEwaRequest builds message with member name and amount', async () => {
      let sentText = '';
      globalThis.fetch = (async (_url: string, opts: any) => {
        const body = JSON.parse(opts.body);
        sentText = body.text;
        return new Response('ok');
      }) as any;

      const mockDb: any = {
        query: () => ({
          all: async () => [
            { key: 'waNotificationEnabled', value: 'true' },
            { key: 'waWebhookUrl', value: 'https://gateway.mock' },
            { key: 'waNotificationTarget', value: '628123456789' },
          ],
        }),
      };

      process.env.APP_URL = 'https://portal.example.com';

      await notifyEwaRequest({
        memberName: 'John Doe',
        memberCode: 'EMP-01',
        amount: 500000,
        db: mockDb,
      });

      // Give async tick a moment
      await new Promise((r) => setTimeout(r, 10));

      expect(sentText).toContain('John Doe');
      expect(sentText).toContain('EMP-01');
      expect(sentText).toContain('Rp 500.000');
      expect(sentText).toContain('https://portal.example.com/ewa');
    });

    it('notifySavingsWithdrawal builds message for voluntary savings withdrawal', async () => {
      let sentText = '';
      globalThis.fetch = (async (_url: string, opts: any) => {
        const body = JSON.parse(opts.body);
        sentText = body.text;
        return new Response('ok');
      }) as any;

      const mockDb: any = {
        query: () => ({
          all: async () => [
            { key: 'waNotificationEnabled', value: 'true' },
            { key: 'waWebhookUrl', value: 'https://gateway.mock' },
            { key: 'waNotificationTarget', value: '628123456789' },
          ],
        }),
      };

      process.env.APP_URL = 'https://portal.example.com';

      await notifySavingsWithdrawal({
        memberName: 'Jane Smith',
        amount: 1000000,
        db: mockDb,
      });

      await new Promise((r) => setTimeout(r, 10));

      expect(sentText).toContain('Jane Smith');
      expect(sentText).toContain('Rp 1.000.000');
      expect(sentText).toContain('https://portal.example.com/savings');
    });

    it('notifySavingsDeposit builds message for transfer deposit confirmation', async () => {
      let sentText = '';
      globalThis.fetch = (async (_url: string, opts: any) => {
        const body = JSON.parse(opts.body);
        sentText = body.text;
        return new Response('ok');
      }) as any;

      const mockDb: any = {
        query: () => ({
          all: async () => [
            { key: 'waNotificationEnabled', value: 'true' },
            { key: 'waWebhookUrl', value: 'https://gateway.mock' },
            { key: 'waNotificationTarget', value: '628123456789' },
          ],
        }),
      };

      process.env.APP_URL = 'https://portal.example.com';

      await notifySavingsDeposit({
        memberName: 'Alice',
        amount: 250000,
        db: mockDb,
      });

      await new Promise((r) => setTimeout(r, 10));

      expect(sentText).toContain('Alice');
      expect(sentText).toContain('Rp 250.000');
      expect(sentText).toContain('https://portal.example.com/savings');
    });

    it('notifyLoanApplication builds message for new loan application', async () => {
      let sentText = '';
      globalThis.fetch = (async (_url: string, opts: any) => {
        const body = JSON.parse(opts.body);
        sentText = body.text;
        return new Response('ok');
      }) as any;

      const mockDb: any = {
        query: () => ({
          all: async () => [
            { key: 'waNotificationEnabled', value: 'true' },
            { key: 'waWebhookUrl', value: 'https://gateway.mock' },
            { key: 'waNotificationTarget', value: '628123456789' },
          ],
        }),
      };

      process.env.APP_URL = 'https://portal.example.com';

      await notifyLoanApplication({
        memberName: 'Bob',
        amount: 5000000,
        tenorMonths: 12,
        db: mockDb,
      });

      await new Promise((r) => setTimeout(r, 10));

      expect(sentText).toContain('Bob');
      expect(sentText).toContain('Rp 5.000.000');
      expect(sentText).toContain('12 bulan');
      expect(sentText).toContain('https://portal.example.com/loans');
    });
  });
});
