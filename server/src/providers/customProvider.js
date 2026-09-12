/**
 * Placeholder for the AI team's custom / local model provider.
 * Implement generateCompletion with the same signature as groqProvider,
 * then flip AI_PROVIDER=custom in .env — no other code changes required.
 */
export const generateCompletion = async () => {
  throw new Error('customProvider is not implemented yet. Set AI_PROVIDER=groq in .env.');
};
