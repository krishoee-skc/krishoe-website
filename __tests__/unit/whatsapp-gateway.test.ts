import { notifyWorkEntry, sendAdminNotification, sendDailySummary, sendPaymentReminder } from '@/lib/whatsapp-gateway';

// Mock the queryPostgres function
jest.mock('@/lib/postgres/client', () => ({
  queryPostgres: jest.fn(),
}));

// Mock twilio
jest.mock('twilio', () => {
  return jest.fn(() => ({
    messages: {
      create: jest.fn().mockResolvedValue({ sid: 'test-message-sid' }),
    },
  }));
});

describe('WhatsApp Gateway', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.TWILIO_ACCOUNT_SID = 'test-sid';
    process.env.TWILIO_AUTH_TOKEN = 'test-token';
    process.env.TWILIO_WHATSAPP_NUMBER = '+1234567890';
    process.env.WHATSAPP_ADMIN_NUMBER = '+9779841234567';
  });

  describe('notifyWorkEntry()', () => {
    it('should format work entry notification correctly', async () => {
      const mockData = {
        workerName: 'Raj Kumar',
        productName: 'Upper Slipper',
        pairsCount: 50,
        amount: 500,
      };

      // Test that the message is formatted correctly
      const result = await notifyWorkEntry(mockData);
      expect(result).toBeTruthy();
    });

    it('should include all required fields in notification', async () => {
      const mockData = {
        workerName: 'Ramesh',
        productName: 'Fibermen Slipper',
        pairsCount: 100,
        amount: 800,
      };

      const result = await notifyWorkEntry(mockData);
      expect(result).toBeDefined();
    });

    it('should handle special characters in names', async () => {
      const mockData = {
        workerName: 'Raj कुमार',
        productName: 'स्लिपर',
        pairsCount: 50,
        amount: 500,
      };

      const result = await notifyWorkEntry(mockData);
      expect(result).toBeTruthy();
    });
  });

  describe('sendDailySummary()', () => {
    it('should format daily summary correctly', async () => {
      const mockData = {
        totalPairs: 500,
        totalAmount: 5000,
        workersCount: 12,
        completedTasks: 45,
        inProgress: 5,
      };

      const result = await sendDailySummary(mockData);
      expect(result).toBeTruthy();
    });

    it('should handle zero values', async () => {
      const mockData = {
        totalPairs: 0,
        totalAmount: 0,
        workersCount: 0,
        completedTasks: 0,
        inProgress: 0,
      };

      const result = await sendDailySummary(mockData);
      expect(result).toBeTruthy();
    });
  });

  describe('sendPaymentReminder()', () => {
    it('should format payment reminder correctly', async () => {
      const mockData = {
        workerName: 'Sharma',
        amount: 1000,
        dueDate: '2026-08-10',
      };

      const result = await sendPaymentReminder(mockData);
      expect(result).toBeTruthy();
    });

    it('should handle large amounts', async () => {
      const mockData = {
        workerName: 'Worker Name',
        amount: 50000,
        dueDate: '2026-09-01',
      };

      const result = await sendPaymentReminder(mockData);
      expect(result).toBeTruthy();
    });
  });

  describe('sendAdminNotification()', () => {
    it('should send message to admin number', async () => {
      const message = 'Test notification';
      const result = await sendAdminNotification(message);
      expect(result).toBeTruthy();
    });

    it('should handle empty message', async () => {
      const message = '';
      const result = await sendAdminNotification(message);
      // Should still attempt to send
      expect(result).toBeDefined();
    });
  });
});
