import React, { useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ALL_LESSONS } from "../features/learning/curriculum";
import { saveLessonCompleted, getProgress } from "../features/learning/progress";
import { logCurriculumMistake } from "../features/learning/curriculumReview";
import { auth } from "../firebase";

export default function CurriculumLesson() {
  const { id } = useParams();
  const navigate = useNavigate();
  const lesson = ALL_LESSONS[id];

  const items = useMemo(() => buildItems(lesson), [lesson]);
  const [currentItemIndex, setCurrentItemIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [feedback, setFeedback] = useState({});

  const handleAnswer = (itemIndex, answer) => {
    const question = items[itemIndex];
    if (!question) return;
    setAnswers((prev) => ({ ...prev, [itemIndex]: answer }));
    const correct = question.answer;
    const isCorrect = String(answer) === String(correct);
    setFeedback((prev) => ({
      ...prev,
      [question.id]: {
        correct: isCorrect,
        expected: correct,
      },
    }));
    if (!isCorrect) {
      logCurriculumMistake({
        lessonId: lesson.id,
        questionId: question.id,
        prompt: question.prompt,
        correctAnswer: correct,
        userAnswer: answer,
        createdAt: new Date().toISOString(),
      });
    }
  };

  const handleNext = () => {
    if (currentItemIndex < items.length - 1) {
      setCurrentItemIndex(prev => prev + 1);
    } else {
      // Lesson finished, calculate score and save progress
      let correctAnswers = 0;
      items.forEach((item, index) => {
        if (item.type === 'mcq' && answers[index] === item.answerIndex) {
          correctAnswers++;
        }
      });
      // Save progress and update streak/xp
      const user = auth.currentUser;
      getProgress(user)
        .then(() => saveLessonCompleted(lesson, user))
        .finally(() => {
          navigate('/curriculum');
        });
    }
  };

  if (!lesson) {
    return <div className="p-8">Lesson not found.</div>;
  }

  const currentItem = items[currentItemIndex];
  const scoreCount = Object.entries(feedback).filter(([, v]) => v?.correct).length;
  const scoreTotal = items.length;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white border border-slate-200 rounded-2xl shadow-[0_8px_28px_-14px_rgba(15,23,42,0.25)] p-6 space-y-4">
          <header className="flex flex-col gap-1">
            <p className="text-xs uppercase tracking-[0.25em] text-slate-500">
              {lesson.levelTitle} • {lesson.unitTitle}
            </p>
            <h1 className="text-2xl font-bold text-slate-900">{lesson.title}</h1>
            {lesson.summary && (
              <p className="text-sm text-slate-600">{lesson.summary}</p>
            )}
          </header>

          <section className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
            <h2 className="text-sm font-semibold text-slate-900">Explanation</h2>
            <p className="text-sm text-slate-700 leading-relaxed">
              {lesson.explanation}
            </p>
          </section>

          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900">Key phrases</h3>
              <button
                className="text-xs text-indigo-600 hover:text-indigo-800"
                onClick={() => navigate(`/pronunciation?target=${encodeURIComponent(lesson.keyPhrases?.[0] || lesson.title)}`)}
              >
                Practice in lab
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {(lesson.keyPhrases || []).map((phrase, idx) => (
                <button
                  key={idx}
                  onClick={() => navigate(`/pronunciation?target=${encodeURIComponent(phrase)}`)}
                  className="px-3 py-1.5 rounded-full border border-slate-200 bg-slate-50 text-sm text-slate-800 hover:border-indigo-200 hover:text-indigo-700 transition"
                >
                  {phrase}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              {(lesson.exampleSentences || []).map((ex, idx) => (
                <button
                  key={`ex-${idx}`}
                  onClick={() => navigate(`/pronunciation?target=${encodeURIComponent(ex)}`)}
                  className="text-left w-full sm:w-auto px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 hover:border-indigo-200 hover:text-indigo-700 transition"
                  title="Practice this in the lab"
                >
                  {ex}
                </button>
              ))}
            </div>
          </section>

          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900">Quick check</h3>
              <span className="text-xs text-slate-500">
                {scoreCount} / {scoreTotal} correct
              </span>
            </div>
            <div className="space-y-3">
              {items.map((q, idx) => (
                <div key={q.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-sm font-semibold text-slate-900 mb-2">
                    {idx + 1}. {q.prompt}
                  </p>
                  <div className="space-y-2">
                    {q.options.map((opt, oidx) => {
                      const selected = answers[idx];
                      const isSelected = selected === opt || selected === oidx;
                      const fb = feedback[q.id];
                      const correct = fb?.expected;
                      return (
                        <button
                          key={`${q.id}-${oidx}`}
                          onClick={() => handleAnswer(idx, opt)}
                          className={`w-full text-left px-3 py-2 rounded-lg border transition ${
                            isSelected
                              ? "border-indigo-300 bg-white"
                              : "border-slate-200 bg-white hover:border-slate-300"
                          }`}
                        >
                          <span className="text-sm text-slate-800">{opt}</span>
                        </button>
                      );
                    })}
                  </div>
                  {feedback[q.id] && (
                    <div className={`mt-2 text-sm rounded-lg px-3 py-2 border ${feedback[q.id].correct ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-800"}`}>
                      {feedback[q.id].correct ? "Correct" : `Correct answer: ${feedback[q.id].expected}`}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>

          <div className="flex items-center justify-between pt-2 border-t border-slate-200">
            <button
              onClick={() => navigate("/curriculum")}
              className="text-sm text-slate-600 hover:text-indigo-600"
            >
              ← Back to curriculum
            </button>
            <button
              onClick={handleNext}
              className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700"
            >
              {currentItemIndex < items.length - 1 ? "Next question" : "Finish lesson"}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}

function buildItems(lesson) {
  if (lesson) {
    if (Array.isArray(lesson.quickCheck) && lesson.quickCheck.length > 0) {
      return lesson.quickCheck;
    }
    if (Array.isArray(lesson.items) && lesson.items.length > 0) {
      return lesson.items;
    }
  }
  const title = lesson?.title || "this lesson";
  const focus = lesson?.summary || "Practise speaking with clear stress and endings.";
  return [
    {
      type: "mcq",
      prompt: `What is the focus of "${title}"?`,
      options: [focus, "A random topic", "Unrelated content"],
      answerIndex: 0,
    },
    {
      type: "pronPhrase",
      phrase: `I am practising "${title.toLowerCase()}".`,
    },
    {
      type: "mcq",
      prompt: "Ready to mark this lesson as done?",
      options: ["Yes, mark complete", "Not yet"],
      answerIndex: 0,
    },
  ];
}
