const { createClient } = require('@deepgram/sdk');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { audio } = req.body;
  if (!audio) {
    return res.status(400).json({ error: 'Missing audio data' });
  }

  try {
    const deepgram = createClient(process.env.DEEPGRAM_API_KEY);
    const audioBuffer = Buffer.from(audio, 'base64');

    const { result } = await deepgram.listen.prerecorded.transcribeFile(
      audioBuffer,
      {
        model: 'nova-2',
        language: 'en',
        smart_format: true,
        punctuate: true,
      }
    );

    const transcript =
      result?.results?.channels?.[0]?.alternatives?.[0]?.transcript || '';

    return res.status(200).json({ transcript });
  } catch (err) {
    console.error('Voice transcription error:', err);
    return res.status(500).json({ error: 'Failed to transcribe audio' });
  }
};
