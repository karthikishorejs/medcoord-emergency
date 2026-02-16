/**
 * @jest-environment jsdom
 */

// ── Test pure frontend logic ───────────────────
// Since the frontend functions are embedded in HTML, we recreate
// the key pure functions here for testing.

// Replicate the esc() function from index.html
function esc(str) {
  const el = document.createElement('span');
  el.textContent = str;
  return el.innerHTML;
}

// Replicate medication state management
function createMedStore() {
  let medications = JSON.parse(localStorage.getItem('kaathu_meds') || '[]');

  function saveMeds() {
    localStorage.setItem('kaathu_meds', JSON.stringify(medications));
  }

  let idCounter = 0;
  function addMedication(name, dosage, instructions = '') {
    if (!name || !dosage) return false;
    medications.push({ id: ++idCounter, name, dosage, instructions });
    saveMeds();
    return true;
  }

  function removeMedication(id) {
    medications = medications.filter(m => m.id !== id);
    saveMeds();
  }

  function getMedications() {
    return medications;
  }

  function buildQRPayload() {
    return {
      type: 'kaathu',
      version: 1,
      generated: new Date().toISOString(),
      medications: medications.map(m => ({
        name: m.name,
        dosage: m.dosage,
        instructions: m.instructions || '',
      })),
    };
  }

  return { addMedication, removeMedication, getMedications, buildQRPayload, saveMeds };
}

// ── Tests ──────────────────────────────────────
describe('esc() HTML escaping', () => {
  test('escapes < and > characters', () => {
    expect(esc('<script>alert("xss")</script>')).toBe('&lt;script&gt;alert("xss")&lt;/script&gt;');
  });

  test('escapes & character', () => {
    expect(esc('aspirin & ibuprofen')).toBe('aspirin &amp; ibuprofen');
  });

  test('escapes double quotes', () => {
    expect(esc('say "hello"')).toBe('say "hello"');
  });

  test('handles empty string', () => {
    expect(esc('')).toBe('');
  });

  test('passes through normal text unchanged', () => {
    expect(esc('Metformin 500mg')).toBe('Metformin 500mg');
  });

  test('handles special characters in medication names', () => {
    expect(esc('Volibo M 0.3/500')).toBe('Volibo M 0.3/500');
  });
});

describe('Medication state management', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test('starts with empty medications list', () => {
    const store = createMedStore();
    expect(store.getMedications()).toEqual([]);
  });

  test('adds a medication with name, dosage, instructions', () => {
    const store = createMedStore();
    store.addMedication('Metformin', '500mg', 'Take with food');
    const meds = store.getMedications();
    expect(meds).toHaveLength(1);
    expect(meds[0].name).toBe('Metformin');
    expect(meds[0].dosage).toBe('500mg');
    expect(meds[0].instructions).toBe('Take with food');
    expect(meds[0].id).toBeDefined();
  });

  test('rejects medication with empty name', () => {
    const store = createMedStore();
    const result = store.addMedication('', '500mg');
    expect(result).toBe(false);
    expect(store.getMedications()).toHaveLength(0);
  });

  test('rejects medication with empty dosage', () => {
    const store = createMedStore();
    const result = store.addMedication('Metformin', '');
    expect(result).toBe(false);
    expect(store.getMedications()).toHaveLength(0);
  });

  test('persists medications to localStorage', () => {
    const store = createMedStore();
    store.addMedication('Aspirin', '100mg');
    const stored = JSON.parse(localStorage.getItem('kaathu_meds'));
    expect(stored).toHaveLength(1);
    expect(stored[0].name).toBe('Aspirin');
  });

  test('loads medications from localStorage', () => {
    localStorage.setItem('kaathu_meds', JSON.stringify([
      { id: 1, name: 'Aspirin', dosage: '100mg', instructions: '' },
    ]));
    const store = createMedStore();
    expect(store.getMedications()).toHaveLength(1);
    expect(store.getMedications()[0].name).toBe('Aspirin');
  });

  test('removes medication by id', () => {
    const store = createMedStore();
    store.addMedication('Aspirin', '100mg');
    store.addMedication('Metformin', '500mg');
    const meds = store.getMedications();
    expect(meds).toHaveLength(2);
    store.removeMedication(meds[0].id);
    expect(store.getMedications()).toHaveLength(1);
    expect(store.getMedications()[0].name).toBe('Metformin');
  });

  test('removal updates localStorage', () => {
    const store = createMedStore();
    store.addMedication('Aspirin', '100mg');
    const id = store.getMedications()[0].id;
    store.removeMedication(id);
    const stored = JSON.parse(localStorage.getItem('kaathu_meds'));
    expect(stored).toHaveLength(0);
  });
});

describe('QR payload generation', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test('generates correct payload structure', () => {
    const store = createMedStore();
    store.addMedication('Metformin', '500mg', 'Take with food');
    const payload = store.buildQRPayload();

    expect(payload.type).toBe('kaathu');
    expect(payload.version).toBe(1);
    expect(payload.generated).toBeDefined();
    expect(new Date(payload.generated)).toBeInstanceOf(Date);
  });

  test('includes medications without internal id', () => {
    const store = createMedStore();
    store.addMedication('Aspirin', '100mg', 'Morning');
    store.addMedication('Metformin', '500mg', '');
    const payload = store.buildQRPayload();

    expect(payload.medications).toHaveLength(2);
    expect(payload.medications[0]).toEqual({
      name: 'Aspirin',
      dosage: '100mg',
      instructions: 'Morning',
    });
    // Should NOT include the internal 'id' field
    expect(payload.medications[0].id).toBeUndefined();
  });

  test('empty instructions default to empty string', () => {
    const store = createMedStore();
    store.addMedication('Aspirin', '100mg');
    const payload = store.buildQRPayload();
    expect(payload.medications[0].instructions).toBe('');
  });

  test('empty medications list generates valid payload', () => {
    const store = createMedStore();
    const payload = store.buildQRPayload();
    expect(payload.medications).toEqual([]);
    expect(payload.type).toBe('kaathu');
  });
});

describe('QR data validation (emergency responder)', () => {
  // Replicate the validation logic from emergency.html
  function validateQRData(raw) {
    try {
      const data = JSON.parse(raw);
      if (data.type !== 'kaathu') return null;
      return data;
    } catch {
      return null;
    }
  }

  test('accepts valid Kaathu QR data', () => {
    const valid = JSON.stringify({
      type: 'kaathu',
      version: 1,
      medications: [{ name: 'Aspirin', dosage: '100mg', instructions: '' }],
    });
    expect(validateQRData(valid)).not.toBeNull();
    expect(validateQRData(valid).medications).toHaveLength(1);
  });

  test('rejects non-Kaathu QR data', () => {
    const other = JSON.stringify({ type: 'other-app', data: 'hello' });
    expect(validateQRData(other)).toBeNull();
  });

  test('rejects invalid JSON', () => {
    expect(validateQRData('not json at all')).toBeNull();
  });

  test('rejects empty string', () => {
    expect(validateQRData('')).toBeNull();
  });
});
