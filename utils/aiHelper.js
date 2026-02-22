// @ts-check
/**
 * utils/aiHelper.js
 *
 * AI-powered Playwright failure explainer using Google Gemini API.
 *
 * Setup:
 *   PowerShell : $env:GEMINI_API_KEY = "AIza..."
 *   CMD        : set GEMINI_API_KEY=AIza...
 *   .env file  : GEMINI_API_KEY=AIza...
 */

const GEMINI_MODEL = 'gemini-1.5-flash';
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

/**
 * Sends a Playwright error message to Google Gemini and returns a
 * formatted explanation with root cause and debugging steps.
 *
 * @param {string} errorMessage - The error message from the failed Playwright test.
 * @returns {Promise<string>} Formatted AI explanation string.
 *
 * @example
 * const explanation = await explainFailure(testInfo.error?.message);
 * console.log(explanation);
 */
export async function explainFailure(errorMessage) {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
        return [
            'AI EXPLANATION:',
            'Explanation: Skipped — GEMINI_API_KEY environment variable is not set.',
            'Root Cause:  N/A',
            'Suggested Fix: Set $env:GEMINI_API_KEY = "AIza..." in your terminal before running tests.',
        ].join('\n');
    }

    const prompt = `You are a senior QA automation engineer.
A Playwright test just failed with the following error message:

"${errorMessage}"

Respond in EXACTLY this format (no extra text, no markdown):

Explanation:
<Explain what went wrong in 2-3 simple sentences a junior QA engineer can understand>

Root Cause:
<The single most likely technical root cause>

Suggested Fix:
<One concrete step or code change to fix the issue>`;

    try {
        const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [
                    {
                        role: 'user',
                        parts: [{ text: prompt }],
                    },
                ],
                generationConfig: {
                    temperature: 0.2,
                    maxOutputTokens: 400,
                },
            }),
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Gemini API responded with ${response.status}: ${errText}`);
        }

        const data = await response.json();

        // Extract the text from Gemini's response structure
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!text) {
            throw new Error('Gemini returned an empty response.');
        }

        return `\nAI EXPLANATION:\n${text.trim()}\n`;

    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return `\nAI EXPLANATION:\nExplanation: AI analysis failed.\nRoot Cause: ${message}\nSuggested Fix: Check your GEMINI_API_KEY and network connection.\n`;
    }
}
