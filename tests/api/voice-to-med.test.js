// Mock the Deepgram SDK before requiring the handler
const mockTranscribeFile = jest.fn();
jest.mock('@deepgram/sdk', () => ({
  createClient: jest.fn(() => ({
    listen: {
      prerecorded: {
        transcribeFile: mockTranscribeFile,
      },
    },
  })),
}));

const handler = require('../../api/voice-to-med');

// ── Mock req/res helpers ───────────────────────
function mockReq(method, body = {}) {
  return { method, body };
}

function mockRes() {
  const res = {};
  res.statusCode = null;
  res._json = null;
  res.status = jest.fn((code) => { res.statusCode = code; return res; });
  res.json = jest.fn((data) => { res._json = data; return res; });
  return res;
}

beforeEach(() => {
  process.env.DEEPGRAM_API_KEY = 'test-deepgram-key';
  mockTranscribeFile.mockReset();
});

// ── Tests ──────────────────────────────────────
describe('voice-to-med API', () => {
  describe('HTTP method validation', () => {
    test('returns 405 for GET request', async () => {
      const req = mockReq('GET');
      const res = mockRes();
      await handler(req, res);
      expect(res.status).toHaveBeenCalledWith(405);
      expect(res._json).toEqual({ error: 'Method not allowed' });
    });

    test('returns 405 for DELETE request', async () => {
      const req = mockReq('DELETE');
      const res = mockRes();
      await handler(req, res);
      expect(res.status).toHaveBeenCalledWith(405);
    });
  });

  describe('input validation', () => {
    test('returns 400 if audio is missing', async () => {
      const req = mockReq('POST', {});
      const res = mockRes();
      await handler(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res._json.error).toMatch(/missing audio/i);
    });
  });

  describe('successful transcription', () => {
    test('calls Deepgram with correct model settings', async () => {
      mockTranscribeFile.mockResolvedValue({
        result: {
          results: {
            channels: [{ alternatives: [{ transcript: 'Metformin 500mg' }] }],
          },
        },
      });

      const req = mockReq('POST', { audio: Buffer.from('fake-audio').toString('base64') });
      const res = mockRes();
      await handler(req, res);

      expect(mockTranscribeFile).toHaveBeenCalledTimes(1);
      const callArgs = mockTranscribeFile.mock.calls[0];
      // First arg is the audio buffer
      expect(Buffer.isBuffer(callArgs[0])).toBe(true);
      // Second arg is the options
      expect(callArgs[1]).toEqual(expect.objectContaining({
        model: 'nova-2',
        language: 'en',
        smart_format: true,
        punctuate: true,
      }));
    });

    test('returns transcript from Deepgram response', async () => {
      mockTranscribeFile.mockResolvedValue({
        result: {
          results: {
            channels: [{ alternatives: [{ transcript: 'Metformin 500mg twice daily' }] }],
          },
        },
      });

      const req = mockReq('POST', { audio: Buffer.from('fake-audio').toString('base64') });
      const res = mockRes();
      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res._json.transcript).toBe('Metformin 500mg twice daily');
    });

    test('returns empty string when no transcript in response', async () => {
      mockTranscribeFile.mockResolvedValue({
        result: {
          results: {
            channels: [{ alternatives: [{}] }],
          },
        },
      });

      const req = mockReq('POST', { audio: Buffer.from('silence').toString('base64') });
      const res = mockRes();
      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res._json.transcript).toBe('');
    });

    test('returns empty string when response structure is missing', async () => {
      mockTranscribeFile.mockResolvedValue({
        result: {},
      });

      const req = mockReq('POST', { audio: Buffer.from('noise').toString('base64') });
      const res = mockRes();
      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res._json.transcript).toBe('');
    });
  });

  describe('error handling', () => {
    test('returns 500 when Deepgram API throws', async () => {
      mockTranscribeFile.mockRejectedValue(new Error('Deepgram service unavailable'));

      const req = mockReq('POST', { audio: Buffer.from('audio').toString('base64') });
      const res = mockRes();
      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res._json.error).toMatch(/failed/i);
    });
  });
});
