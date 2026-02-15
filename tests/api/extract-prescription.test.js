// Mock the Anthropic SDK before requiring the handler
const mockCreate = jest.fn();
jest.mock('@anthropic-ai/sdk', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      messages: { create: mockCreate },
    })),
  };
});

const handler = require('../../api/extract-prescription');

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
  process.env.ANTHROPIC_API_KEY = 'test-anthropic-key';
  mockCreate.mockReset();
});

// ── Tests ──────────────────────────────────────
describe('extract-prescription API', () => {
  describe('HTTP method validation', () => {
    test('returns 405 for GET request', async () => {
      const req = mockReq('GET');
      const res = mockRes();
      await handler(req, res);
      expect(res.status).toHaveBeenCalledWith(405);
      expect(res._json).toEqual({ error: 'Method not allowed' });
    });
  });

  describe('input validation', () => {
    test('returns 400 if image is missing', async () => {
      const req = mockReq('POST', {});
      const res = mockRes();
      await handler(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res._json.error).toMatch(/missing image/i);
    });
  });

  describe('successful extraction', () => {
    test('sends image to Claude with correct model', async () => {
      mockCreate.mockResolvedValue({
        content: [{ text: '{ "medications": [] }' }],
      });

      const req = mockReq('POST', { image: 'base64data', mimeType: 'image/png' });
      const res = mockRes();
      await handler(req, res);

      expect(mockCreate).toHaveBeenCalledTimes(1);
      const callArgs = mockCreate.mock.calls[0][0];
      expect(callArgs.model).toBe('claude-sonnet-4-20250514');
      expect(callArgs.max_tokens).toBe(1024);
    });

    test('uses provided mimeType', async () => {
      mockCreate.mockResolvedValue({
        content: [{ text: '{ "medications": [] }' }],
      });

      const req = mockReq('POST', { image: 'base64data', mimeType: 'image/png' });
      const res = mockRes();
      await handler(req, res);

      const callArgs = mockCreate.mock.calls[0][0];
      const imageBlock = callArgs.messages[0].content[0];
      expect(imageBlock.source.media_type).toBe('image/png');
    });

    test('defaults mimeType to image/jpeg', async () => {
      mockCreate.mockResolvedValue({
        content: [{ text: '{ "medications": [] }' }],
      });

      const req = mockReq('POST', { image: 'base64data' });
      const res = mockRes();
      await handler(req, res);

      const callArgs = mockCreate.mock.calls[0][0];
      const imageBlock = callArgs.messages[0].content[0];
      expect(imageBlock.source.media_type).toBe('image/jpeg');
    });

    test('parses plain JSON response from Claude', async () => {
      const medications = [
        { name: 'Metformin', dosage: '500mg', instructions: 'Twice daily', pattern: '1-0-1' },
      ];
      mockCreate.mockResolvedValue({
        content: [{ text: JSON.stringify({ medications }) }],
      });

      const req = mockReq('POST', { image: 'base64data' });
      const res = mockRes();
      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res._json.medications).toHaveLength(1);
      expect(res._json.medications[0].name).toBe('Metformin');
      expect(res._json.medications[0].pattern).toBe('1-0-1');
    });

    test('parses JSON wrapped in markdown code fences', async () => {
      const medications = [
        { name: 'Aspirin', dosage: '100mg', instructions: 'Once daily', pattern: '1-0-0' },
      ];
      const fencedResponse = '```json\n' + JSON.stringify({ medications }) + '\n```';
      mockCreate.mockResolvedValue({
        content: [{ text: fencedResponse }],
      });

      const req = mockReq('POST', { image: 'base64data' });
      const res = mockRes();
      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res._json.medications).toHaveLength(1);
      expect(res._json.medications[0].name).toBe('Aspirin');
    });

    test('returns empty medications when no JSON in response', async () => {
      mockCreate.mockResolvedValue({
        content: [{ text: 'I cannot read this image clearly.' }],
      });

      const req = mockReq('POST', { image: 'base64data' });
      const res = mockRes();
      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res._json.medications).toEqual([]);
    });

    test('returns empty medications when content is empty', async () => {
      mockCreate.mockResolvedValue({
        content: [{}],
      });

      const req = mockReq('POST', { image: 'base64data' });
      const res = mockRes();
      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res._json.medications).toEqual([]);
    });

    test('prompt includes dosing pattern instructions', async () => {
      mockCreate.mockResolvedValue({
        content: [{ text: '{ "medications": [] }' }],
      });

      const req = mockReq('POST', { image: 'base64data' });
      const res = mockRes();
      await handler(req, res);

      const callArgs = mockCreate.mock.calls[0][0];
      const promptText = callArgs.messages[0].content[1].text;
      expect(promptText).toContain('Morning-Afternoon-Night');
      expect(promptText).toContain('0-0-1');
      expect(promptText).toContain('Once daily at night');
      expect(promptText).toContain('STRICT mapping');
    });
  });

  describe('error handling', () => {
    test('returns 500 when Claude API throws', async () => {
      mockCreate.mockRejectedValue(new Error('API rate limited'));

      const req = mockReq('POST', { image: 'base64data' });
      const res = mockRes();
      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res._json.error).toMatch(/failed/i);
    });
  });
});
