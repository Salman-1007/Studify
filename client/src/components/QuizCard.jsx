import React from 'react';
import { Flag, Check } from 'lucide-react';

export default function QuizCard({
  question,
  selectedOption,
  isFlagged,
  onSelectOption,
  onToggleFlag,
  questionIndex,
  totalQuestions,
}) {
  if (!question) return null;

  const options = [
    { key: 'A', numKey: '1', text: question.optionA },
    { key: 'B', numKey: '2', text: question.optionB },
    { key: 'C', numKey: '3', text: question.optionC },
    { key: 'D', numKey: '4', text: question.optionD },
  ];

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 sm:p-8 space-y-6 shadow-xl backdrop-blur-sm transition-all">
      {/* Header with question index, difficulty & flag button */}
      <div className="flex items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
        <div className="flex items-center gap-2.5">
          <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-blue-500/10 text-blue-400 border border-blue-500/20">
            Question {questionIndex + 1} of {totalQuestions}
          </span>
          {question.difficulty && (
            <span className="text-xs font-medium px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700/50">
              {question.difficulty}
            </span>
          )}
          {question.topic && (
            <span className="hidden sm:inline-block text-xs text-slate-400 font-medium truncate max-w-xs">
              • {question.topic}
            </span>
          )}
        </div>

        {/* Flag button */}
        <button
          type="button"
          onClick={onToggleFlag}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
            isFlagged
              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm shadow-amber-500/10'
              : 'bg-slate-800/80 text-slate-400 border border-slate-700 hover:text-slate-200 hover:bg-slate-800'
          }`}
          title="Flag this question to review later (Hotkey: F)"
        >
          <Flag size={13} className={isFlagged ? 'fill-amber-400 text-amber-400' : ''} />
          <span>{isFlagged ? 'Flagged' : 'Flag'}</span>
          <kbd className="hidden sm:inline-block ml-1 px-1.5 py-0.5 text-[10px] font-mono bg-slate-900 border border-slate-700 rounded text-slate-400">
            F
          </kbd>
        </button>
      </div>

      {/* Question Text */}
      <div className="py-1">
        <p className="text-base sm:text-lg font-medium text-slate-100 leading-relaxed tracking-wide select-none">
          {question.questionText}
        </p>
      </div>

      {/* Options List */}
      <div className="space-y-3 pt-2">
        {options.map(({ key, numKey, text }) => {
          const isSelected = selectedOption === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => onSelectOption(key)}
              className={`w-full text-left p-4 rounded-xl border transition-all duration-150 flex items-center justify-between gap-4 cursor-pointer group ${
                isSelected
                  ? 'border-blue-500 bg-blue-500/15 text-white ring-1 ring-blue-500/40 shadow-md shadow-blue-500/10'
                  : 'border-slate-800 bg-slate-900/40 text-slate-300 hover:border-slate-700 hover:bg-slate-800/50'
              }`}
            >
              <div className="flex items-center gap-3.5 flex-1 min-w-0">
                <span
                  className={`w-7 h-7 rounded-lg text-xs font-bold flex items-center justify-center shrink-0 transition-colors ${
                    isSelected
                      ? 'bg-blue-500 text-white shadow-sm'
                      : 'border border-slate-700 bg-slate-800 text-slate-400 group-hover:border-slate-600 group-hover:text-slate-200'
                  }`}
                >
                  {key}
                </span>
                <span className="text-sm font-medium leading-relaxed break-words">
                  {text}
                </span>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {isSelected && (
                  <Check size={16} className="text-blue-400 animate-in fade-in" />
                )}
                <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono rounded bg-slate-800 border border-slate-700 text-slate-500 group-hover:text-slate-400">
                  {key} / {numKey}
                </kbd>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

