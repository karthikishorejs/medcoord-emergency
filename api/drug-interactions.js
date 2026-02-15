module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { medications } = req.body;
  if (!medications || !Array.isArray(medications) || medications.length < 2) {
    return res.status(400).json({ error: 'Provide at least two medication names' });
  }

  try {
    const query = `drug interactions between ${medications.join(' and ')}`;

    const response = await fetch(
      `https://ydc-index.io/v1/search?query=${encodeURIComponent(query)}`,
      {
        headers: {
          'X-API-Key': process.env.YOU_API_KEY,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`You.com API returned ${response.status}`);
    }

    const data = await response.json();
    const webResults = (data.results && data.results.web) || [];
    const snippets = webResults
      .slice(0, 5)
      .map(result => {
        const parts = [];
        if (result.description) parts.push(result.description);
        if (result.snippets && Array.isArray(result.snippets)) parts.push(...result.snippets);
        return parts.join(' ');
      })
      .filter(Boolean);

    // Build interaction pairs from the search results
    const interactions = [];
    const medPairs = [];
    for (let i = 0; i < medications.length; i++) {
      for (let j = i + 1; j < medications.length; j++) {
        medPairs.push(`${medications[i]} + ${medications[j]}`);
      }
    }

    // Check each snippet for mentions of medication pairs
    for (const pair of medPairs) {
      const [medA, medB] = pair.split(' + ');
      const relevant = snippets.filter(
        s => s.toLowerCase().includes(medA.toLowerCase()) ||
             s.toLowerCase().includes(medB.toLowerCase())
      );
      if (relevant.length > 0) {
        interactions.push({
          pair,
          description: relevant[0].slice(0, 300),
          severity: categorizeSeverity(relevant[0]),
        });
      }
    }

    return res.status(200).json({ interactions });
  } catch (err) {
    console.error('Drug interaction check error:', err);
    return res.status(500).json({ error: 'Failed to check drug interactions' });
  }
};

// Exported for testing
module.exports.categorizeSeverity = categorizeSeverity;

function categorizeSeverity(text) {
  const lower = text.toLowerCase();
  if (lower.includes('severe') || lower.includes('dangerous') || lower.includes('fatal') || lower.includes('contraindicated')) {
    return 'Severe';
  }
  if (lower.includes('moderate') || lower.includes('caution') || lower.includes('monitor')) {
    return 'Moderate';
  }
  return 'Mild';
}
