import Groq from 'groq-sdk';

let client = null;
const getClient = () => {
  if (!process.env.GROQ_API_KEY) return null;
  if (!client) client = new Groq({ apiKey: process.env.GROQ_API_KEY });
  return client;
};

const MODEL = () => process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';

/**
 * generateCompletion({ system, messages }) -> string
 * Thin wrapper. All prompt engineering lives in aiService, not here,
 * so swapping providers never requires touching business logic.
 */
export const generateCompletion = async ({ system, messages, jsonMode = false }) => {
  const groq = getClient();
  if (!groq) {
    throw new Error('GROQ_API_KEY is not configured on the server');
  }
  const chatMessages = [
    ...(system ? [{ role: 'system', content: system }] : []),
    ...messages,
  ];
  const completion = await groq.chat.completions.create({
    model: MODEL(),
    messages: chatMessages,
    temperature: 0.4,
    ...(jsonMode ? { response_format: { type: 'json_object' } } : {}),
  });
  return completion.choices[0]?.message?.content ?? '';
};
