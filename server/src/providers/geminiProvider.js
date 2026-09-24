import * as groqProvider from './groqProvider.js';

const DEFAULT_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

export const generateCompletion = async({ system, messages, jsonMode = false }) => {
    const apiKey = process.env.GEMINI_API_KEY;

    // Fallback to Groq if Gemini API key is not configured in environment
    if (!apiKey) {
        return groqProvider.generateCompletion({ system, messages, jsonMode });
    }

    const model = DEFAULT_MODEL;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

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
            console.warn(`[Gemini API Error] Status ${res.status}: ${errText}. Falling back to Groq.`);
            return groqProvider.generateCompletion({ system, messages, jsonMode });
        }

        const data = await res.json();
        const candidate = data.candidates ?.[0];
        const textPart = candidate ?.content ?.parts ?.[0] ?.text;

        if (!textPart) {
            throw new Error('Gemini returned an empty candidate text');
        }

        return textPart;
    } catch (err) {
        console.warn(`[Gemini Provider] Request failed: ${err.message}. Falling back to Groq.`);
        return groqProvider.generateCompletion({ system, messages, jsonMode });
    }
};