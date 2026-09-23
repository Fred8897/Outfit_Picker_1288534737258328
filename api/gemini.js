import { GoogleGenAI } from '@google/genai';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { base64Img } = req.body;
  if (!base64Img) {
    return res.status(400).json({ error: 'Missing base64Img in request body' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'GEMINI_API_KEY environment variable is not configured' });
  }

  const ai = new GoogleGenAI({ apiKey });
  const modelsToTry = [
    "gemini-2.5-flash", "gemini-3.7-flash", "gemini-3.1-pro-preview"
  ];

  let lastError = null;

  for (const modelName of modelsToTry) {
    try {
      const response = await ai.models.generateContent({
        model: modelName,
        contents: [{
          role: 'user',
          parts: [
            { inlineData: { data: base64Img, mimeType: 'image/jpeg' } },
            { text: 'Analyze this clothing item. Return ONLY a JSON object with this exact structure (no markdown): { "layer": "coats"|"tops"|"bottoms"|"shoes"|"bags", "name": "A short descriptive name", "colors": ["primary color"], "occasion": ["casual"|"work"|"party"], "temperature": ["hot"|"medium"|"cold"], "weather": ["sun"|"rain"|"cloudy"], "hiddenTags": ["fabric or style descriptor"] }' }
          ]
        }]
      });

      const rawText = typeof response.text === 'function' ? response.text() : response.text;
      const jsonText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
      const metadata = JSON.parse(jsonText);

      return res.status(200).json(metadata);
    } catch (err) {
      lastError = err;
    }
  }

  return res.status(500).json({ error: `AI tagging failed: ${lastError?.message}` });
}