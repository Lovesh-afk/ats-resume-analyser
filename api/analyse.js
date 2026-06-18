// api/analyse.js — Vercel Serverless Function
// Runs on Vercel's server, not in the browser.
// Frontend calls this at /api/analyse

export default async function handler(req, res) {

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { resume, jd } = req.body;

  if (!resume || !jd) {
    return res.status(400).json({ error: 'Resume and job description are required.' });
  }

  // API key stored in Vercel environment variables
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'API key not configured on server.' });
  }

  const prompt = `
You are an ATS (Applicant Tracking System) expert.
Analyse the resume below against the job description and return ONLY a JSON object.
Do not add any explanation, markdown, or code fences. Just raw JSON.

Resume:
${resume}

Job Description:
${jd}

Return this exact JSON structure:
{
  "score": <a number from 0 to 100 representing how well the resume matches the JD>,
  "matched_keywords": [<up to 10 keywords/skills found in both the resume and JD>],
  "missing_keywords": [<up to 10 important keywords in the JD that are missing from the resume>],
  "suggestions": [<4 to 5 specific tips to improve the resume for this JD>],
  "summary": "<2 to 3 sentences summarising the overall fit>"
}
  `.trim();

  try {
    const claudeResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        messages: [
          { role: 'user', content: prompt }
        ]
      })
    });

    if (!claudeResponse.ok) {
      const errorData = await claudeResponse.json();
      const errorMessage = errorData?.error?.message || 'Claude API call failed.';
      return res.status(500).json({ error: errorMessage });
    }

    const claudeData = await claudeResponse.json();
    let rawText = claudeData.content[0].text;

    // Strip markdown code fences just in case
    rawText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();

    const result = JSON.parse(rawText);
    return res.status(200).json(result);

  } catch (error) {
    return res.status(500).json({ error: 'Something went wrong: ' + error.message });
  }
}