import * as groqProvider from '../providers/groqProvider.js';
import * as customProvider from '../providers/customProvider.js';
import * as geminiProvider from '../providers/geminiProvider.js';

// Dynamically select Gemini if GEMINI_API_KEY is present or AI_PROVIDER === 'gemini'
export const getProvider = () => {
  if (process.env.AI_PROVIDER === 'custom') return customProvider;
  if (process.env.GEMINI_API_KEY || process.env.AI_PROVIDER === 'gemini') return geminiProvider;
  return groqProvider;
};

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
  const prov = getProvider();
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const raw = await prov.generateCompletion({ system, messages, jsonMode: true });
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

  const prov = getProvider();
  try {
    return await prov.generateCompletion({ system, messages });
  } catch (err) {
    console.error(`[AI Chat Service] AI generation failed: ${err.message}`);
    return `Hello! I am your Studify AI Tutor. I'm currently having trouble connecting to the AI language model (Details: ${err.message?.slice(0, 90)}). Please ensure a valid \`GEMINI_API_KEY\` or \`GROQ_API_KEY\` is configured in your hosting environment settings. In the meantime, you can explore the Punjab Textbook Board chapters and practice tests directly in the Question Bank!`;
  }
};

export const generateSummary = async ({ text, title }) => {
  const system = 'You are an educational summarizer. Given study material, produce: a concise summary, a bullet list of key points, and a bullet list of important definitions. Respond in Markdown with headings "## Summary", "## Key Points", "## Definitions".';
  const messages = [{ role: 'user', content: `Material title: ${title || 'Untitled'}\n\n${text.slice(0, 12000)}` }];
  const prov = getProvider();
  return prov.generateCompletion({ system, messages });
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

export const generateMistakeDiagnostic = async ({ testTitle, score, totalQuestions, percentage, mistakes }) => {
  const system = [
    'You are Studify\'s Senior Academic Tutor specialized in the Pakistani Board Examination Curriculum (Punjab Textbook Board / PECTAA / Federal Board).',
    'Analyze the student\'s practice test mistakes and return ONLY a valid JSON object matching this schema:',
    '{',
    '  "headline": string,',
    '  "summary": string,',
    '  "keyMisconceptions": [',
    '    {',
    '      "topic": string,',
    '      "studentConfusion": string,',
    '      "ruleOrFact": string',
    '    }',
    '  ],',
    '  "recommendedRevisionChapters": string[],',
    '  "quickActionPlan": string',
    '}',
  ].join('\n');

  const mistakesSummary = mistakes.slice(0, 10).map((m, idx) => `
${idx + 1}. Question: "${m.questionText}"
Student selected: [${m.selectedOption || 'Skipped'}]
Correct answer: [${m.correctAnswer}]
Explanation: ${m.explanation || 'None provided'}
Chapter: ${m.chapterName || 'General'}
`).join('\n');

  const prompt = `Practice Test: "${testTitle || 'Board Chapter Test'}"
Score: ${score}/${totalQuestions} (${percentage}%)
Mistakes to diagnose:
${mistakesSummary}

Provide a deep, constructive diagnostic to help this matric student ace their upcoming board exam.`;

  const messages = [{ role: 'user', content: prompt }];
  const prov = getProvider();

  try {
    const raw = await prov.generateCompletion({ system, messages, jsonMode: true });
    return extractJson(raw);
  } catch (err) {
    console.warn(`[AI Diagnostic] Diagnostic generation error: ${err.message}. Providing structured analysis.`);
    return {
      headline: percentage >= 80 ? 'Distinction level performance with minor gaps' : percentage >= 50 ? 'Solid passing foundation with targeted revisions needed' : 'Needs foundational review before test day',
      summary: `You scored ${score}/${totalQuestions} (${percentage}%). Reviewing your ${mistakes.length} mistakes will directly help boost your board exam score.`,
      keyMisconceptions: mistakes.slice(0, 3).map((m) => ({
        topic: m.chapterName || 'Key Concepts',
        studentConfusion: `Option [${m.selectedOption || 'Skipped'}] was selected instead of [${m.correctAnswer}].`,
        ruleOrFact: m.explanation || 'Review textbook chapter definitions, solved examples, and summary formulas.',
      })),
      recommendedRevisionChapters: Array.from(new Set(mistakes.map((m) => m.chapterName).filter(Boolean))),
      quickActionPlan: 'Re-read the bold definitions in your Punjab Textbook and retake this chapter test to confirm mastery.',
    };
  }
};

