const handler = require('../../api/drug-interactions');
const { categorizeSeverity } = require('../../api/drug-interactions');

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

// ── Mock global fetch ──────────────────────────
beforeEach(() => {
  global.fetch = jest.fn();
  process.env.YOU_API_KEY = 'test-you-key';
});

afterEach(() => {
  delete global.fetch;
  jest.restoreAllMocks();
});

// ── Tests ──────────────────────────────────────
describe('drug-interactions API', () => {
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
    test('returns 400 if medications missing', async () => {
      const req = mockReq('POST', {});
      const res = mockRes();
      await handler(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res._json.error).toMatch(/at least two/i);
    });

    test('returns 400 if medications is not an array', async () => {
      const req = mockReq('POST', { medications: 'aspirin' });
      const res = mockRes();
      await handler(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    test('returns 400 if fewer than 2 medications', async () => {
      const req = mockReq('POST', { medications: ['Aspirin'] });
      const res = mockRes();
      await handler(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('successful interaction check', () => {
    test('calls You.com API with correct query', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => ({ results: { web: [] } }),
      });

      const req = mockReq('POST', { medications: ['Aspirin', 'Ibuprofen'] });
      const res = mockRes();
      await handler(req, res);

      expect(global.fetch).toHaveBeenCalledTimes(1);
      const url = global.fetch.mock.calls[0][0];
      expect(url).toContain('ydc-index.io/v1/search');
      expect(url).toContain('Aspirin');
      expect(url).toContain('Ibuprofen');
    });

    test('returns interactions when API finds matching results', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          results: {
            web: [
              {
                description: 'Aspirin and Ibuprofen have a moderate interaction. Use caution when combining.',
                snippets: ['NSAIDs like Aspirin and Ibuprofen should not be taken together without medical advice.'],
              },
            ],
          },
        }),
      });

      const req = mockReq('POST', { medications: ['Aspirin', 'Ibuprofen'] });
      const res = mockRes();
      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res._json.interactions).toHaveLength(1);
      expect(res._json.interactions[0].pair).toBe('Aspirin + Ibuprofen');
      expect(res._json.interactions[0].severity).toBe('Moderate');
    });

    test('returns empty interactions when no relevant results', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          results: {
            web: [
              {
                description: 'Unrelated health article about vitamins.',
                snippets: ['Everything you need to know about vitamin supplements.'],
              },
            ],
          },
        }),
      });

      const req = mockReq('POST', { medications: ['Aspirin', 'Ibuprofen'] });
      const res = mockRes();
      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res._json.interactions).toHaveLength(0);
    });

    test('handles 3 medications and generates all pairs', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => ({ results: { web: [] } }),
      });

      const req = mockReq('POST', { medications: ['A', 'B', 'C'] });
      const res = mockRes();
      await handler(req, res);

      // 3 medications = 3 pairs (A+B, A+C, B+C)
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res._json.interactions).toBeDefined();
    });
  });

  describe('error handling', () => {
    test('returns 500 when You.com API fails', async () => {
      global.fetch.mockResolvedValue({
        ok: false,
        status: 503,
      });

      const req = mockReq('POST', { medications: ['Aspirin', 'Ibuprofen'] });
      const res = mockRes();
      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res._json.error).toMatch(/failed/i);
    });

    test('returns 500 when fetch throws', async () => {
      global.fetch.mockRejectedValue(new Error('Network error'));

      const req = mockReq('POST', { medications: ['Aspirin', 'Ibuprofen'] });
      const res = mockRes();
      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });
});

describe('categorizeSeverity', () => {
  test('returns Severe for "severe" keyword', () => {
    expect(categorizeSeverity('This is a severe interaction')).toBe('Severe');
  });

  test('returns Severe for "dangerous" keyword', () => {
    expect(categorizeSeverity('dangerous combination')).toBe('Severe');
  });

  test('returns Severe for "fatal" keyword', () => {
    expect(categorizeSeverity('potentially fatal')).toBe('Severe');
  });

  test('returns Severe for "contraindicated" keyword', () => {
    expect(categorizeSeverity('these drugs are contraindicated')).toBe('Severe');
  });

  test('returns Moderate for "moderate" keyword', () => {
    expect(categorizeSeverity('moderate risk of interaction')).toBe('Moderate');
  });

  test('returns Moderate for "caution" keyword', () => {
    expect(categorizeSeverity('use caution when combining')).toBe('Moderate');
  });

  test('returns Moderate for "monitor" keyword', () => {
    expect(categorizeSeverity('monitor patient closely')).toBe('Moderate');
  });

  test('returns Mild as default', () => {
    expect(categorizeSeverity('minor interaction possible')).toBe('Mild');
  });

  test('returns Mild for empty string', () => {
    expect(categorizeSeverity('')).toBe('Mild');
  });

  test('is case-insensitive', () => {
    expect(categorizeSeverity('SEVERE DANGER')).toBe('Severe');
    expect(categorizeSeverity('MODERATE risk')).toBe('Moderate');
  });

  test('severe takes priority over moderate keywords', () => {
    expect(categorizeSeverity('severe interaction, monitor closely')).toBe('Severe');
  });
});
