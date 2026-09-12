import * as groqProvider from '../providers/groqProvider.js';
import * as customProvider from '../providers/customProvider.js';

// Swapping providers (e.g. to the team's own AI models) is a one-line change here.
const provider = process.env.AI_PROVIDER === 'custom' ? customProvider : groqProvider;

const extractJson = (raw) => {
  const cleaned = raw.replace(/```json|```/g, '').trim();
  const start = cleaned.indexOf('{');
  const arrStart = cleaned.indexOf('[');
  let candidate = cleaned;
  if (start !== -1 && (arrStart === -1 || start < arrStart)) {
    candidate = cleaned.slice(start);
  } else if (arrStart !== -1) {
    candidate = cleaned.slice(arrStart);
  }
  return JSON.parse(candidate);
};

const withJsonRetry = async ({ system, messages }) => {
  let lastErr;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const raw = await provider.generateCompletion({ system, messages, jsonMode: true });
      return extractJson(raw);
    } catch (err) {
      lastErr = err;
      messages = [...messages, { role: 'user', content: 'Your previous response was not valid JSON matching the schema. Return ONLY valid JSON, no prose.' }];
    }
  }
  throw new Error(`AI returned malformed JSON after retry: ${lastErr.message}`);
};

export const generateChatResponse = async ({ history, message, materialContext, topic }) => {
  const system = [
    'You are Studify\'s AI Mentor, an encouraging and precise educational tutor.',
    'Explain concepts clearly, use short paragraphs, and give examples when helpful.',
    topic ? `The student is currently studying: ${topic}.` : '',
    materialContext ? `Relevant study material excerpt:\n${materialContext.slice(0, 4000)}` : '',
  ].filter(Boolean).join('\n');

  const messages = [
    ...history.map((m) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content })),
    { role: 'user', content: message },
  ];

  return provider.generateCompletion({ system, messages });
};

export const generateSummary = async ({ text, title }) => {
  const system = 'You are an educational summarizer. Given study material, produce: a concise summary, a bullet list of key points, and a bullet list of important definitions. Respond in Markdown with headings "## Summary", "## Key Points", "## Definitions".';
  const messages = [{ role: 'user', content: `Material title: ${title || 'Untitled'}\n\n${text.slice(0, 12000)}` }];
  return provider.generateCompletion({ system, messages });
};

export const generateQuiz = async ({ topic, subject, difficulty, numQuestions, materialText }) => {
  const system = [
    'You generate structured educational quizzes.',
    'Respond with ONLY valid JSON matching exactly this schema:',
    '{"title": string, "questions": [{"question": string, "type": "mcq"|"true_false"|"fill_blank", "options": string[] | null, "correctAnswer": string, "explanation": string}]}',
    'For "mcq" always include 4 options. For "true_false" options must be ["True","False"]. For "fill_blank" options must be null.',
  ].join('\n');
  const messages = [{
    role: 'user',
    content: `Create a ${difficulty} quiz with ${numQuestions} questions on topic "${topic}"${subject ? ` (subject: ${subject})` : ''}.${materialText ? `\nBase it on this material:\n${materialText.slice(0, 6000)}` : ''}`,
  }];
  const data = await withJsonRetry({ system, messages });
  if (!data.questions || !Array.isArray(data.questions) || data.questions.length === 0) {
    throw new Error('AI quiz response missing questions array');
  }
  return data;
};

export const generateFlashcards = async ({ topic, numCards = 10, materialText }) => {
  const system = 'You generate flashcards. Respond with ONLY valid JSON: {"cards": [{"front": string, "back": string}]}';
  const messages = [{
    role: 'user',
    content: `Create ${numCards} flashcards on topic "${topic}".${materialText ? `\nBase it on this material:\n${materialText.slice(0, 6000)}` : ''}`,
  }];
  const data = await withJsonRetry({ system, messages });
  if (!data.cards || !Array.isArray(data.cards)) throw new Error('AI flashcard response missing cards array');
  return data;
};

export const generateStudyPlan = async ({ weakTopics, subjects, availableHoursPerWeek }) => {
  const system = 'You are a study planner. Respond with ONLY valid JSON: {"plan": [{"day": string, "focus": string, "durationMinutes": number, "notes": string}]}';
  const messages = [{
    role: 'user',
    content: `Weak topics: ${weakTopics.join(', ') || 'none identified yet'}. Subjects: ${subjects.join(', ') || 'general'}. Available study time: ${availableHoursPerWeek} hours/week. Create a 7-day plan prioritizing weak topics.`,
  }];
  return withJsonRetry({ system, messages });
};
