// =============================================
// api/analyse.js — Vercel Serverless Function
//
// This file runs on Vercel's server, NOT in
// the browser. So the API key stays secret.
//
// The frontend calls this at /api/analyse
// We add the key here and call Gemini.
// =============================================

export default async function handler(req, res) {

  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Read resume text and job description sent from the frontend
  const { resume, jd } = req.body;

  // Basic validation
  if (!resume || !jd) {
    return res.status(400).json({ error: 'Resume and job description are required.' });
  }

  // Get the Gemini API key from Vercel environment variables
  // (set this in Vercel → Project → Settings → Environment Variables)
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'API key not configured on server.' });
  }

  // Build the prompt for Gemini
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
    // Call the Gemini API
    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            { parts: [{ text: prompt }] }
          ],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 1024
          }
        })
      }
    );

    // If Gemini returned an error, pass it along
    if (!geminiResponse.ok) {
      const errorData = await geminiResponse.json();
      const errorMessage = errorData?.error?.message || 'Gemini API call failed.';
      return res.status(500).json({ error: errorMessage });
    }

    // Pull out the text from Gemini's response
    const geminiData = await geminiResponse.json();
    let rawText = geminiData.candidates[0].content.parts[0].text;

    // Strip markdown code fences if Gemini wraps the JSON in them
    rawText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();

    // Parse and send the result back to the frontend
    const result = JSON.parse(rawText);
    return res.status(200).json(result);

  } catch (error) {
    return res.status(500).json({ error: 'Something went wrong: ' + error.message });
  }
}