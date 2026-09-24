import * as groqProvider from './groqProvider.js';

let activeModel = null;

const getCandidateModels = () => {
    const preferredModel = (process.env.GEMINI_MODEL || 'gemini-3.6-flash').replace(/^models\//, '');
    const fallbackList = ['gemini-3.8-flash', 'gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash'];
    if (activeModel) {
        return Array.from(new Set([activeModel, preferredModel, ...fallbackList]));
    }
    return Array.from(new Set([preferredModel, ...fallbackList]));
};

export const generateCompletion = async({ system, messages, jsonMode = false }) => {
    const apiKey = process.env.GEMINI_API_KEY;

    // Fallback to Groq if Gemini API key is not configured in environment
    if (!apiKey) {
        return groqProvider.generateCompletion({ system, messages, jsonMode });
    }

    const candidateModels = getCandidateModels();

    // Map messages to Gemini format (role: 'user' | 'model')
    const contents = messages.map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
    }));

    const body = {
        contents,
        generationConfig: {
            temperature: 0.4,
            maxOutputTokens: 2048,
            ...(jsonMode ? { responseMimeType: 'application/json' } : {}),
        },
    };

    if (system) {
        body.system_instruction = {
            parts: [{ text: system }],
        };
    }

    let lastError = null;

    for (let i = 0; i < candidateModels.length; i++) {
        const model = candidateModels[i];
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

        try {
            const res = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(body),
            });

            if (!res.ok) {
                const errText = await res.text();
                lastError = new Error(`Gemini status ${res.status}: ${errText}`);

                // If 404 (model not found / deprecated / not available to new users), try next candidate model
                if (res.status === 404 && i < candidateModels.length - 1) {
                    console.warn(`[Gemini API] Model "${model}" returned 404. Attempting fallback model "${candidateModels[i + 1]}"...`);
                    continue;
                }

                // If non-404 error or last candidate, stop model attempts
                console.warn(`[Gemini API Error] Model "${model}" failed (status ${res.status}): ${errText}. Attempting Groq fallback.`);
                break;
            }

            const data = await res.json();
            const candidate = data.candidates ?.[0];
            const textPart = candidate ?.content ?.parts ?.[0] ?.text;

            if (!textPart) {
                throw new Error('Gemini returned an empty candidate text');
            }

            // Cache successfully responding model for subsequent requests
            activeModel = model;
            return textPart;
        } catch (err) {
            lastError = err;
            console.warn(`[Gemini Provider] Request with model "${model}" failed: ${err.message}.`);
            if (i < candidateModels.length - 1) {
                continue;
            }
        }
    }

    // If Gemini candidate models failed, attempt Groq fallback if configured
    if (process.env.GROQ_API_KEY) {
        try {
            console.warn('[Gemini Provider] Attempting fallback to Groq...');
            return await groqProvider.generateCompletion({ system, messages, jsonMode });
        } catch (groqErr) {
            console.error(`[Groq Fallback Error] ${groqErr.message}`);
            throw new Error(`AI providers failed. Gemini: ${lastError?.message || 'unavailable'}. Groq: ${groqErr.message}`);
        }
    }

    throw lastError || new Error('Gemini completion failed and no Groq fallback is configured');
};