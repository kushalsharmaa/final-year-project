// src/pages/Quiz.js
import React, { useEffect, useMemo, useState } from "react";
import { getSummary } from "../lib/api";
import { app, auth } from "../firebase";
import { getFirestore, addDoc, collection, serverTimestamp } from "firebase/firestore";
import { ArrowPathIcon, CheckCircleIcon } from "@heroicons/react/24/solid";

const FALLBACK_WORDS = ["morning", "coffee", "family", "lesson", "travel", "music", "book", "practice", "weather", "friend"];
const HINTS = {
  morning: "The start of the day.",
  coffee: "A hot drink from a cafe.",
  family: "Parents, children, relatives.",
  lesson: "A class or study session.",
  travel: "Going to another place.",
  music: "Songs you listen to.",
  book: "You read it.",
  practice: "Do something many times to improve.",
  weather: "Rain, sun, wind and snow.",
  friend: "Someone you like to spend time with.",
};

function uniq(arr = []) {
  const seen = new Set();
  return arr.filter((w) => {
    const k = String(w || "").trim().toLowerCase();
    if (!k || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

function shuffle(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function buildQuestions(hardWords = []) {
  const pool = uniq([...hardWords, ...FALLBACK_WORDS]);
  const total = Math.min(10, Math.max(8, pool.length));
  const questions = [];

  for (let i = 0; i < total; i += 1) {
    const correct = pool[i % pool.length];
    const wrongPool = pool.filter((w) => w !== correct);
    const wrongs = shuffle(wrongPool.length ? wrongPool : FALLBACK_WORDS).slice(0, 3);
    const options = shuffle([correct, ...wrongs]);
    const answerIndex = options.indexOf(correct);
    questions.push({
      id: `q-${i}`,
      word: correct,
      options,
      answerIndex,
      hint: HINTS[correct] || `Pick the correct spelling for "${correct}".`,
    });
  }
  return questions;
}

export default function Quiz() {
  const db = useMemo(() => getFirestore(app), []);
  const [loading, setLoading] = useState(true);
  const [questions, setQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [finished, setFinished] = useState(false);
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState("");
  const [savedResult, setSavedResult] = useState(false);

  useEffect(() => {
    let on = true;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const data = await getSummary({ limit: 100 });
        if (!on) return;
        const fromHard = data?.hardestWords || [];
        const fromItems = (data?.items || []).flatMap((row) => row.hardWords || []);
        const qs = buildQuestions(uniq([...fromHard, ...fromItems]));
        setQuestions(qs);
      } catch (e) {
        if (!on) return;
        setError("Could not load your quiz. Using simple practice words.");
        setQuestions(buildQuestions(FALLBACK_WORDS));
      } finally {
        if (on) setLoading(false);
      }
    })();
    return () => { on = false; };
  }, []);

  const currentQuestion = questions[currentIndex] || null;
  const total = questions.length;
  const correctCount = answers.filter((a) => a.correct).length;
  const percent = total ? Math.round((correctCount / total) * 100) : 0;

  const handleSelect = (idx) => {
    if (!currentQuestion || selected !== null) return;
    const choice = currentQuestion.options[idx];
    const correct = idx === currentQuestion.answerIndex;
    setSelected(idx);
    setAnswers((prev) => [...prev, { id: currentQuestion.id, choice, correct }]);
    setTimeout(() => {
      setSelected(null);
      if (currentIndex + 1 >= total) {
        setFinished(true);
      } else {
        setCurrentIndex((i) => i + 1);
      }
    }, 220);
  };

  useEffect(() => {
    if (!finished || savedResult || !auth.currentUser || !total) return;
    (async () => {
      try {
        const uid = auth.currentUser.uid;
        const hardWordsUsed = uniq(questions.map((q) => q.word)).slice(0, 20);
        await addDoc(collection(db, "quizResults", uid, "history"), {
          createdAt: serverTimestamp(),
          correct: correctCount,
          total,
          hardWordsUsed,
        });
      } catch (e) {
        console.warn("[quiz] failed to store result", e?.message || e);
      } finally {
        setSavedResult(true);
      }
    })();
  }, [finished, savedResult, db, correctCount, total, questions]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-800">
        <main className="max-w-4xl mx-auto p-6">
          <p className="text-sm text-slate-600">Loading your quiz...</p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      <main className="max-w-4xl mx-auto p-6 space-y-5">
        <header className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm text-slate-500">quiz</p>
            <h1 className="text-3xl font-bold text-slate-900">Quick five minute quiz</h1>
            <p className="text-slate-600 mt-1">Based on your hardest words.</p>
          </div>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="flex items-center gap-2 px-3 py-2 rounded-lg border bg-white text-sm hover:bg-slate-50"
          >
            <ArrowPathIcon className="h-4 w-4" />
            restart
          </button>
        </header>

        {error && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 text-amber-800 px-3 py-2 text-sm">
            {error}
          </div>
        )}

        {!finished && currentQuestion && (
          <section className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between text-sm text-slate-600">
              <span>Question {currentIndex + 1} of {total}</span>
              <span>Score so far: {correctCount}/{total}</span>
            </div>
            <div>
              <p className="text-lg font-semibold text-slate-900 mb-1">
                Pick the correct answer
              </p>
              <p className="text-sm text-slate-600">{currentQuestion.hint}</p>
            </div>
            <div className="space-y-2">
              {currentQuestion.options.map((opt, idx) => {
                const isPicked = selected === idx;
                const base = "w-full text-left p-3 rounded-xl border transition-all";
                const pickedCls = isPicked ? "border-indigo-500 bg-indigo-50" : "border-slate-200 hover:border-indigo-200 hover:bg-indigo-50/50";
                return (
                  <button
                    key={opt + idx}
                    type="button"
                    onClick={() => handleSelect(idx)}
                    className={`${base} ${pickedCls}`}
                  >
                    {opt}
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {finished && (
          <section className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Quiz complete</h2>
            <p className="text-slate-600 mb-4">Here is your result.</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
              <ResultItem label="Correct" value={correctCount} icon={<CheckCircleIcon className="h-6 w-6 text-emerald-500" />} />
              <ResultItem label="Total" value={total} icon={<ArrowPathIcon className="h-6 w-6 text-slate-400" />} />
              <ResultItem label="Score" value={`${percent}%`} icon={<CheckCircleIcon className="h-6 w-6 text-indigo-500" />} />
            </div>
            <p className="text-sm text-slate-600 mb-4">
              {percent >= 80 ? "Great work! Keep the momentum." : percent >= 50 ? "Getting there. Review the tough words once more." : "No worries. Try again after a quick review."}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700"
            >
              Take another quiz
            </button>
          </section>
        )}
      </main>
    </div>
  );
}

function ResultItem({ label, value, icon }) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 bg-slate-50">
      <div className="h-9 w-9 rounded-lg bg-white border border-slate-200 grid place-items-center">
        {icon}
      </div>
      <div>
        <div className="text-sm text-slate-500">{label}</div>
        <div className="text-lg font-semibold text-slate-900">{value}</div>
      </div>
    </div>
  );
}
