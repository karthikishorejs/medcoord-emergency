const Anthropic = require('@anthropic-ai/sdk').default;

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { medications } = req.body;
  if (!medications || !Array.isArray(medications) || medications.length === 0) {
    return res.status(400).json({ error: 'Missing or invalid medications array' });
  }

  try {
    const drugList = medications.map(m => m.name || m).join(', ');

    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      messages: [
        {
          role: 'user',
          content: `For each medication below, provide the most probable medical condition it is commonly prescribed for. Use short, patient-friendly labels (e.g., "Diabetes", "Hypertension", "Cholesterol", "Blood Thinner", "Acid Reflux", "Thyroid", "Asthma", "Pain Relief", "Antibiotic", "Allergy", "Heart", "Depression", "Anxiety", etc.).

Medications: ${drugList}

Return ONLY valid JSON — an object mapping each medication name (exactly as given) to its condition:
{ "Metformin": "Diabetes", "Amlodipine": "Hypertension" }

If you are unsure about a medication, use "General" as the condition. Do NOT add explanations.`,
        },
      ],
    });

    const text = message.content[0]?.text || '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return res.status(200).json({ conditions: {} });
    }

    const conditions = JSON.parse(jsonMatch[0]);
    return res.status(200).json({ conditions });
  } catch (err) {
    console.error('Drug condition lookup error:', err);
    return res.status(500).json({ error: 'Failed to look up drug conditions' });
  }
};
