const Anthropic = require('@anthropic-ai/sdk').default;

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { image, mimeType } = req.body;
  if (!image) {
    return res.status(400).json({ error: 'Missing image data' });
  }

  // Accept the mime type from the client, default to jpeg
  const mediaType = mimeType || 'image/jpeg';

  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mediaType,
                data: image,
              },
            },
            {
              type: 'text',
              text: `You are a medical prescription reader specializing in handwritten Indian prescriptions.

## STEP 1: Read medication names (LEFT side of each line)
- "T." or "Tab." = Tablet
- "C." or "Cap." = Capsule
- "Inj." = Injection
- "Rx" or "℞" = Prescription header (not a medication)
- "M" in a drug name usually means a Metformin combination (e.g., "Volibo M 0.3/500" = Voglibose 0.3mg + Metformin 500mg)
- "CV" in a drug name may indicate a cardiovascular formulation (e.g., "Rosuras CV 75/10")
- CRITICAL: If the same medication name appears on MULTIPLE lines with DIFFERENT doses or DIFFERENT patterns, you MUST create a SEPARATE entry for EACH line. Do NOT merge them.
  Example: "Glimepiride 2mg 1-0-0" and "Glimepiride 1mg 0-0-1" = TWO separate entries:
    Entry 1: { "name": "Glimepiride", "dosage": "2mg", "instructions": "Once daily in the morning", "pattern": "1-0-0" }
    Entry 2: { "name": "Glimepiride", "dosage": "1mg", "instructions": "Once daily at night", "pattern": "0-0-1" }
  Do NOT combine these into a single entry like "Glimepiride 2mg 1-0-1". Each line on the prescription is its own entry.

## STEP 2: Read the dosing pattern (RIGHT side of each line)
CRITICAL: Each medication line has a 3-number pattern written to its RIGHT. This pattern represents Morning-Afternoon-Night dosing. You MUST read the EXACT numbers/marks from the image. DO NOT guess or infer the frequency from the drug name.

The pattern may appear as digits (1-0-1), circles (●○●), or other handwritten marks. Each position means:
- First number = Morning dose
- Second number = Afternoon dose
- Third number = Night dose

STRICT mapping (use EXACTLY these instructions based on the pattern you read):
- 1-0-0 → "Once daily in the morning"
- 0-1-0 → "Once daily in the afternoon"
- 0-0-1 → "Once daily at night"
- 1-1-0 → "Twice daily (morning and afternoon)"
- 1-0-1 → "Twice daily (morning and night)"
- 0-1-1 → "Twice daily (afternoon and night)"
- 1-1-1 → "Three times daily (morning, afternoon, and night)"

If you cannot clearly read the pattern, write "Pattern unclear" in instructions.

## STEP 3: Infer probable medical condition
For each medication, infer the most likely medical condition it is prescribed for. Use concise labels:
- Diabetes medications (Metformin, Glimepiride, Voglibose, Sitagliptin, etc.) → "Diabetes"
- Blood pressure medications (Amlodipine, Telmisartan, Losartan, Ramipril, etc.) → "Hypertension"
- Cholesterol medications (Atorvastatin, Rosuvastatin) → "Cholesterol"
- Blood thinners (Aspirin, Clopidogrel, Warfarin) → "Blood Thinner"
- Acid reflux medications (Pantoprazole, Omeprazole, Rabeprazole) → "Acid Reflux"
- Thyroid medications (Levothyroxine, Thyronorm) → "Thyroid"
- Asthma medications (Montelukast, Salbutamol) → "Asthma"
- If unsure, omit the "condition" field for that medication.

## OUTPUT FORMAT
Return ONLY valid JSON:
{ "medications": [ { "name": "Full medication name", "dosage": "dose with units", "instructions": "frequency from pattern mapping above", "pattern": "X-X-X", "condition": "Probable condition" } ] }

IMPORTANT: The "pattern" field must contain the exact 3-number pattern you read from the image (e.g., "0-0-1"). The "instructions" field must match the strict mapping above for that pattern. The "condition" field should be the probable medical condition (omit if unsure).

If no medications are found, return { "medications": [] }.`,
            },
          ],
        },
      ],
    });

    const text = message.content[0]?.text || '';
    // Extract JSON from the response (it may be wrapped in markdown code fences)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return res.status(200).json({ medications: [] });
    }

    const parsed = JSON.parse(jsonMatch[0]);
    return res.status(200).json(parsed);
  } catch (err) {
    console.error('Prescription extraction error:', err);
    return res.status(500).json({ error: 'Failed to extract prescription data' });
  }
};
