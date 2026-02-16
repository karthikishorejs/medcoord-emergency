const Anthropic = require('@anthropic-ai/sdk').default;

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { transcript } = req.body;
  if (!transcript || typeof transcript !== 'string' || transcript.trim().length === 0) {
    return res.status(400).json({ error: 'Missing or invalid transcript' });
  }

  try {
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 256,
      messages: [
        {
          role: 'user',
          content: `You are a medication transcript parser. A patient spoke aloud a medication name and dosage. Extract the drug name and dosage from the transcript.

Transcript: "${transcript.trim()}"

Extract the following fields:
- name: The medication/drug name (capitalize first letter, e.g. "Metformin", "Amlodipine", "Tylenol")
- dosage: The dose with units (e.g. "500 mg", "10 mg", "75 mcg"). Convert spoken numbers ("five hundred" → "500"). Convert spoken units ("milligrams" → "mg", "micrograms" → "mcg"). If no dose is mentioned, leave empty string.
- condition: The most probable medical condition this drug treats. Use short labels: "Diabetes", "Hypertension", "Cholesterol", "Blood Thinner", "Acid Reflux", "Thyroid", "Asthma", "Allergy", "Pain Relief", "Antibiotic", "Heart", "Depression", "Anxiety", "General". If unsure, use "General".

Examples:
- "Metformin 500 mg" → {"name":"Metformin","dosage":"500 mg","condition":"Diabetes"}
- "I take aspirin 75 mg" → {"name":"Aspirin","dosage":"75 mg","condition":"Blood Thinner"}
- "Amlodipine 5 milligrams" → {"name":"Amlodipine","dosage":"5 mg","condition":"Hypertension"}
- "Tylenol 200 mg" → {"name":"Tylenol","dosage":"200 mg","condition":"Pain Relief"}
- "Pantoprazole" → {"name":"Pantoprazole","dosage":"","condition":"Acid Reflux"}
- "Thyronorm 50 mcg" → {"name":"Thyronorm","dosage":"50 mcg","condition":"Thyroid"}

Return ONLY valid JSON. No explanations. If you cannot identify a medication name, return {"name":"","dosage":"","condition":""}.`,
        },
      ],
    });

    const text = message.content[0]?.text || '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return res.status(200).json({ name: '', dosage: '', condition: '' });
    }

    const parsed = JSON.parse(jsonMatch[0]);
    // Ensure all fields exist with defaults
    const result = {
      name: parsed.name || '',
      dosage: parsed.dosage || '',
      condition: parsed.condition || '',
    };
    // Add warning if no medication name was identified
    if (!result.name.trim()) {
      result._parseWarning = 'Could not identify a medication name from the transcript';
    }
    return res.status(200).json(result);
  } catch (err) {
    console.error('Medication parse error:', err);
    return res.status(500).json({ error: 'Failed to parse medication transcript' });
  }
};
