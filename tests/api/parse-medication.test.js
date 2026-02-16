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

const handler = require('../../api/parse-medication');

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
describe('parse-medication API', () => {
  describe('HTTP method validation', () => {
    test('returns 405 for GET request', async () => {
      const req = mockReq('GET');
      const res = mockRes();
      await handler(req, res);
      expect(res.status).toHaveBeenCalledWith(405);
      expect(res._json).toEqual({ error: 'Method not allowed' });
    });

    test('returns 405 for PUT request', async () => {
      const req = mockReq('PUT');
      const res = mockRes();
      await handler(req, res);
      expect(res.status).toHaveBeenCalledWith(405);
    });
  });

  describe('input validation', () => {
    test('returns 400 if transcript is missing', async () => {
      const req = mockReq('POST', {});
      const res = mockRes();
      await handler(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res._json.error).toMatch(/missing or invalid transcript/i);
    });

    test('returns 400 if transcript is empty string', async () => {
      const req = mockReq('POST', { transcript: '   ' });
      const res = mockRes();
      await handler(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res._json.error).toMatch(/missing or invalid transcript/i);
    });

    test('returns 400 if transcript is not a string', async () => {
      const req = mockReq('POST', { transcript: 123 });
      const res = mockRes();
      await handler(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('successful parsing', () => {
    test('sends transcript to Claude Haiku', async () => {
      mockCreate.mockResolvedValue({
        content: [{ text: '{"name":"Metformin","dosage":"500 mg","condition":"Diabetes"}' }],
      });

      const req = mockReq('POST', { transcript: 'Metformin 500 mg' });
      const res = mockRes();
      await handler(req, res);

      expect(mockCreate).toHaveBeenCalledTimes(1);
      const callArgs = mockCreate.mock.calls[0][0];
      expect(callArgs.model).toBe('claude-haiku-4-5-20251001');
      expect(callArgs.max_tokens).toBe(256);
    });

    test('returns parsed medication data with name, dosage, condition', async () => {
      mockCreate.mockResolvedValue({
        content: [{ text: '{"name":"Metformin","dosage":"500 mg","condition":"Diabetes"}' }],
      });

      const req = mockReq('POST', { transcript: 'Metformin 500 mg' });
      const res = mockRes();
      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res._json.name).toBe('Metformin');
      expect(res._json.dosage).toBe('500 mg');
      expect(res._json.condition).toBe('Diabetes');
    });

    test('parses medication with no dosage', async () => {
      mockCreate.mockResolvedValue({
        content: [{ text: '{"name":"Aspirin","dosage":"","condition":"Blood Thinner"}' }],
      });

      const req = mockReq('POST', { transcript: 'Aspirin' });
      const res = mockRes();
      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res._json.name).toBe('Aspirin');
      expect(res._json.dosage).toBe('');
      expect(res._json.condition).toBe('Blood Thinner');
    });

    test('handles JSON wrapped in markdown code fences', async () => {
      const jsonStr = '{"name":"Amlodipine","dosage":"5 mg","condition":"Hypertension"}';
      mockCreate.mockResolvedValue({
        content: [{ text: '```json\n' + jsonStr + '\n```' }],
      });

      const req = mockReq('POST', { transcript: 'Amlodipine 5 mg' });
      const res = mockRes();
      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res._json.name).toBe('Amlodipine');
      expect(res._json.dosage).toBe('5 mg');
      expect(res._json.condition).toBe('Hypertension');
    });

    test('returns defaults when no medication identified', async () => {
      mockCreate.mockResolvedValue({
        content: [{ text: '{"name":"","dosage":"","condition":""}' }],
      });

      const req = mockReq('POST', { transcript: 'hello world' });
      const res = mockRes();
      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res._json.name).toBe('');
      expect(res._json.dosage).toBe('');
      expect(res._json.condition).toBe('');
    });

    test('returns defaults when Claude returns no JSON', async () => {
      mockCreate.mockResolvedValue({
        content: [{ text: 'I could not understand the transcript.' }],
      });

      const req = mockReq('POST', { transcript: 'garbled audio' });
      const res = mockRes();
      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res._json.name).toBe('');
      expect(res._json.dosage).toBe('');
      expect(res._json.condition).toBe('');
    });

    test('normalizes missing fields with defaults', async () => {
      // Claude returns partial JSON without condition
      mockCreate.mockResolvedValue({
        content: [{ text: '{"name":"Pantoprazole","dosage":"40 mg"}' }],
      });

      const req = mockReq('POST', { transcript: 'Pantoprazole 40 mg' });
      const res = mockRes();
      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res._json.name).toBe('Pantoprazole');
      expect(res._json.dosage).toBe('40 mg');
      expect(res._json.condition).toBe('');
    });

    test('prompt includes transcript text', async () => {
      mockCreate.mockResolvedValue({
        content: [{ text: '{"name":"Metformin","dosage":"500 mg","condition":"Diabetes"}' }],
      });

      const req = mockReq('POST', { transcript: 'I take Metformin 500 mg' });
      const res = mockRes();
      await handler(req, res);

      const callArgs = mockCreate.mock.calls[0][0];
      const promptText = callArgs.messages[0].content;
      expect(promptText).toContain('I take Metformin 500 mg');
    });

    test('adds _parseWarning when no medication name identified', async () => {
      mockCreate.mockResolvedValue({
        content: [{ text: '{"name":"","dosage":"","condition":""}' }],
      });

      const req = mockReq('POST', { transcript: 'hello' });
      const res = mockRes();
      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res._json.name).toBe('');
      expect(res._json._parseWarning).toBeDefined();
    });
  });

  describe('error handling', () => {
    test('returns 500 when Claude API throws', async () => {
      mockCreate.mockRejectedValue(new Error('API rate limited'));

      const req = mockReq('POST', { transcript: 'Metformin 500 mg' });
      const res = mockRes();
      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res._json.error).toMatch(/failed/i);
    });

    test('returns 500 when content is empty', async () => {
      mockCreate.mockResolvedValue({
        content: [{}],
      });

      const req = mockReq('POST', { transcript: 'Metformin 500 mg' });
      const res = mockRes();
      await handler(req, res);

      // Should return defaults, not crash
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res._json.name).toBe('');
    });
  });
});
