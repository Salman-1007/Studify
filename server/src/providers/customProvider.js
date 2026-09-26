/**
 * Custom / Local AI Model Provider.
 * Connects to any OpenAI-compatible API endpoint (e.g. vLLM, Ollama, Hugging Face TGI, or custom model server).
 * Configure in your environment variables:
 *   AI_PROVIDER=custom
 *   CUSTOM_MODEL_ENDPOINT=https://your-custom-model-server.com/v1/chat/completions
 *   CUSTOM_MODEL_API_KEY=your_optional_key
 *   CUSTOM_MODEL_NAME=studify-custom-model
 */
export const generateCompletion = async ({ system, messages, jsonMode = false }) => {
  const endpoint = process.env.CUSTOM_MODEL_ENDPOINT || 'http://localhost:8000/v1/chat/completions';
  const apiKey = process.env.CUSTOM_MODEL_API_KEY || '';
  const model = process.env.CUSTOM_MODEL_NAME || 'studify-custom-v1';

  const formattedMessages = [];
  if (system) {
    formattedMessages.push({ role: 'system', content: system });
  }
  for (const m of messages) {
    formattedMessages.push({ role: m.role, content: m.content });
  }

  const payload = {
    model,
    messages: formattedMessages,
    temperature: 0.7,
  };
  if (jsonMode) {
    payload.response_format = { type: 'json_object' };
  }

  const headers = {
    'Content-Type': 'application/json',
  };
  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }

  const res = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errorText = await res.text().catch(() => '');
    throw new Error(`Custom model request failed (${res.status}): ${errorText.slice(0, 150)}`);
  }

  const data = await res.json();
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error('Custom model returned empty response');
  return text;
};
