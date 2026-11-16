/**
 * Canonical normalizer for quiz and standard test questions.
 * Handles all schemas seamlessly:
 * - QuestionBankItem: { questionText, optionA, optionB, optionC, optionD }
 * - Question: { question, options: string[] | object }
 * - Object key-values: { options: { A: '...', B: '...' } }
 */
export function normalizeQuestion(q) {
  if (!q) return null;

  const prompt = q.questionText || q.question || q.prompt || q.text || 'Question';

  let options = [];
  if (q.optionA !== undefined || q.optionB !== undefined) {
    const list = [
      { key: 'A', text: q.optionA ?? '' },
      { key: 'B', text: q.optionB ?? '' },
      { key: 'C', text: q.optionC ?? '' },
      { key: 'D', text: q.optionD ?? '' },
    ];
    options = list.filter(
      (opt) => opt.text !== null && opt.text !== undefined && String(opt.text).trim() !== ''
    );
  } else if (Array.isArray(q.options)) {
    options = q.options.map((opt, i) => {
      const letter = String.fromCharCode(65 + i);
      if (typeof opt === 'string') {
        return { key: letter, text: opt };
      }
      return {
        key: opt.key || letter,
        text: opt.text || opt.label || opt.option || String(opt),
      };
    });
  } else if (q.options && typeof q.options === 'object') {
    options = Object.entries(q.options).map(([k, v]) => ({
      key: String(k).toUpperCase(),
      text: typeof v === 'string' ? v : (v?.text || String(v)),
    }));
  }

  return {
    ...q,
    id: q.id || q.questionId,
    questionText: prompt,
    question: prompt,
    options,
  };
}

export function normalizeQuestionList(questions) {
  if (!Array.isArray(questions)) return [];
  return questions.map(normalizeQuestion).filter(Boolean);
}
