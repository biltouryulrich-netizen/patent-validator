const fetch = require('node-fetch');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { idea } = req.body || {};
  if (!idea || idea.length < 20) return res.status(400).json({ error: 'Idea too short' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API key not configured on server' });

  const systemPrompt = `You are a world-class patent analyst with deep expertise in USPTO and WIPO patent databases, patent law, and innovation strategy. Analyze invention descriptions and produce realistic patent similarity reports.

Return ONLY a valid JSON object — no markdown, no backticks, no explanation. Use this exact structure:

{
  "keywords": ["keyword1", "keyword2", "keyword3", "keyword4", "keyword5"],
  "confidence": <integer 0-100 representing how likely the idea is unique>,
  "verdict": "<'clear' OR 'found'>",
  "verdictTitle": "<concise verdict title, max 8 words>",
  "verdictDescription": "<2-3 sentences explaining the verdict, referencing specific aspects of the idea>",
  "patents": [
    {
      "title": "<realistic patent title matching the invention domain>",
      "number": "<real-format patent number e.g. US10234567B2>",
      "year": <4-digit year between 2010 and 2023>,
      "assignee": "<real company or plausible inventor name>",
      "summary": "<one sentence describing what aspect of this patent overlaps with the user's idea>",
      "relevance": "<'high', 'medium', or 'low'>"
    }
  ],
  "suggestions": [
    "<specific actionable suggestion tailored to THIS exact idea>",
    "<another suggestion referencing a specific technical differentiation>",
    "<a third suggestion about a niche, material, method, or user group not covered by existing patents>"
  ],
  "confidenceNote": "<2 sentence explanation of the confidence score with domain knowledge>"
}

Rules:
- keywords: 4-6 most technically specific terms
- confidence: 70-92 = appears novel; 40-69 = overlapping area; 10-39 = heavily patented space
- patents: 0-3 entries only. Return 0 if idea seems genuinely novel
- suggestions must be SPECIFIC to this exact invention, not generic
- verdictDescription must reference specific features of the described idea`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1200,
        system: systemPrompt,
        messages: [{ role: 'user', content: `Analyze this invention idea:\n\n"${idea}"` }]
      })
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      return res.status(response.status).json({ error: err?.error?.message || `Error ${response.status}` });
    }

    const data = await response.json();
    const text = data.content.map(b => b.text || '').join('');
    const parsed = JSON.parse(text.replace(/```json|```/g, '').trim());
    return res.status(200).json(parsed);

  } catch (err) {
    return res.status(500).json({ error: err.message || 'Unknown error' });
  }
};
