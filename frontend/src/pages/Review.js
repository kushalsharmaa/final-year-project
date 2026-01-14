// src/pages/Review.js
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getSummary } from "../lib/api";
import { addUserPhrase } from "../lib/db";
import { ArrowPathIcon, BookmarkIcon } from "@heroicons/react/24/solid";
import { getCurriculumMistakes } from "../features/learning/curriculumReview";
import { ALL_LESSONS } from "../features/learning/curriculum";

function buildHardWordCounts(items = [], hardestWords = []) {
  const freq = {};
  hardestWords.forEach((w) => {
    const k = String(w || "").trim().toLowerCase();
    if (k) freq[k] = freq[k] || 0;
  });
  items.forEach((row) => {
    (row.hardWords || []).forEach((w) => {
      const k = String(w || "").trim().toLowerCase();
      if (!k) return;
      freq[k] = (freq[k] || 0) + 1;
    });
  });
  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([word, count]) => ({ word, count }));
}

export default function Review() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [hardWords, setHardWords] = useState([]);
  const [sentences, setSentences] = useState([]);
  const [noteMsg, setNoteMsg] = useState("");
  const [curriculumMistakes, setCurriculumMistakes] = useState([]);
  const [activeTab, setActiveTab] = useState("lab");

  useEffect(() => {
    let on = true;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const data = await getSummary({ limit: 100 });
        if (!on) return;
        const hw = buildHardWordCounts(data.items || [], data.hardestWords || []);
        setHardWords(hw);

        const attempted = (data.items || []).filter((row) => (row.hardWords || []).length > 0);
        setSentences(attempted.slice(0, 10));

        const curriculum = await getCurriculumMistakes(20);
        if (on) setCurriculumMistakes(curriculum || []);
      } catch (e) {
        if (!on) return;
        setError("Loading your mistakes failed. Try again in a moment.");
      } finally {
        if (on) setLoading(false);
      }
    })();
    return () => { on = false; };
  }, []);

  const handleAddPhrase = async (text) => {
    if (!text) return;
    setNoteMsg("saving...");
    try {
      await addUserPhrase({ text });
      setNoteMsg("added to notes");
    } catch {
      setNoteMsg("could not save");
    } finally {
      setTimeout(() => setNoteMsg(""), 1500);
    }
  };

  const showEmpty =
    !loading &&
    !error &&
    hardWords.length === 0 &&
    sentences.length === 0 &&
    curriculumMistakes.length === 0;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      <main className="max-w-5xl mx-auto p-6 space-y-6">
        <header className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm text-slate-500">review</p>
            <h1 className="text-3xl font-bold text-slate-900">Review past mistakes</h1>
            <p className="text-slate-600 mt-1">
              Focus on the words and sentences you usually miss.
            </p>
          </div>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="flex items-center gap-2 px-3 py-2 rounded-lg border bg-white text-sm hover:bg-slate-50"
          >
            <ArrowPathIcon className="h-4 w-4" />
            refresh
          </button>
        </header>

        {loading && (
          <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-600">
            Loading your mistakes...
          </div>
        )}

        {error && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-800 text-sm">
            {error}
          </div>
        )}

        {showEmpty && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-800 text-sm">
            No mistakes recorded yet. Go to the lab and record your first sentence.
          </div>
        )}

        {!loading && !showEmpty && (
          <div className="space-y-4">
            <div className="flex gap-3">
              <button
                onClick={() => setActiveTab("lab")}
                className={`px-3 py-2 rounded-lg text-sm font-semibold border ${
                  activeTab === "lab"
                    ? "bg-white text-slate-900 border-slate-300"
                    : "bg-slate-100 text-slate-600 border-slate-200"
                }`}
              >
                Pronunciation lab
              </button>
              <button
                onClick={() => setActiveTab("curriculum")}
                className={`px-3 py-2 rounded-lg text-sm font-semibold border ${
                  activeTab === "curriculum"
                    ? "bg-white text-slate-900 border-slate-300"
                    : "bg-slate-100 text-slate-600 border-slate-200"
                }`}
              >
                Curriculum
              </button>
            </div>

            {activeTab === "lab" && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <LabHardWords
                  hardWords={hardWords}
                  noteMsg={noteMsg}
                  onAddPhrase={handleAddPhrase}
                  navigate={navigate}
                />
                <LabProblemSentences sentences={sentences} onAddPhrase={handleAddPhrase} navigate={navigate} />
              </div>
            )}

            {activeTab === "curriculum" && (
              <CurriculumMistakesList items={curriculumMistakes} navigate={navigate} />
            )}
          </div>
        )}
      </main>
    </div>
  );
}

function LabHardWords({ hardWords, noteMsg, onAddPhrase, navigate }) {
  return (
    <section className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Your tricky words</h2>
          <p className="text-sm text-slate-500">Top repeat mistakes, up to 10.</p>
        </div>
        {noteMsg && (
          <span className="text-xs px-2 py-1 rounded bg-slate-100 text-slate-600 border border-slate-200">
            {noteMsg}
          </span>
        )}
      </div>
      {hardWords.length ? (
        <div className="flex flex-wrap gap-2">
          {hardWords.map(({ word, count }) => (
            <div key={word} className="flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-slate-50">
              <div className="font-semibold text-slate-800">{word}</div>
              <div className="text-xs text-slate-500">×{count || 1}</div>
              <div className="flex items-center gap-1">
                <button
                  className="px-2 py-1 rounded bg-indigo-600 text-white text-xs hover:bg-indigo-700"
                  onClick={() => navigate(`/pronunciation?target=${encodeURIComponent(word)}`)}
                >
                  practice in lab
                </button>
                <button
                  className="px-2 py-1 rounded border text-xs hover:bg-slate-50"
                  onClick={() => onAddPhrase(word)}
                >
                  add to notes
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-slate-500">No hard words yet. Great job!</p>
      )}
    </section>
  );
}

function LabProblemSentences({ sentences, onAddPhrase, navigate }) {
  return (
    <section className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
      <h2 className="text-xl font-semibold text-slate-900 mb-2">Problem sentences</h2>
      <p className="text-sm text-slate-500 mb-4">
        Recent attempts with tricky words.
      </p>
      {sentences.length ? (
        <div className="space-y-3">
          {sentences.map((row, idx) => (
            <div key={`${row.id || idx}`} className="p-3 rounded-xl border border-slate-200 bg-slate-50">
              <div className="flex items-center justify-between gap-2">
                <div className="text-xs font-semibold text-indigo-700 uppercase tracking-wide">
                  {row.lessonId ? `lesson ${row.lessonId}` : "free practice"}
                </div>
                {(row.hardWords || []).length > 0 && (
                  <div className="text-[11px] text-slate-500">
                    hard words: {(row.hardWords || []).join(", ")}
                  </div>
                )}
              </div>
              <div className="mt-2">
                <p className="text-sm text-slate-800 font-semibold">Target</p>
                <p className="text-sm text-slate-700">{row.target || "—"}</p>
              </div>
              {row.transcript && (
                <div className="mt-1">
                  <p className="text-sm text-slate-800 font-semibold">Transcript</p>
                  <p className="text-sm text-slate-600">{row.transcript}</p>
                </div>
              )}
              <div className="mt-2 flex items-center gap-2">
                <button
                  className="px-3 py-1.5 rounded bg-indigo-600 text-white text-sm hover:bg-indigo-700"
                  onClick={() => navigate(`/pronunciation?target=${encodeURIComponent(row.target || "")}`)}
                >
                  practice this sentence
                </button>
                <button
                  className="px-3 py-1.5 rounded border text-sm hover:bg-slate-50 flex items-center gap-1"
                  onClick={() => onAddPhrase(row.target || "")}
                >
                  <BookmarkIcon className="h-4 w-4 text-slate-600" />
                  add to notes
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-slate-500">No problem sentences yet.</p>
      )}
    </section>
  );
}

function CurriculumMistakesList({ items, navigate }) {
  const hydrated = items.map((row) => {
    const lessonTitle = row.lessonId ? ALL_LESSONS[row.lessonId]?.title : null;
    return { ...row, lessonTitle };
  });

  return (
    <section className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Curriculum mistakes</h2>
          <p className="text-sm text-slate-500">Recent quick-check misses.</p>
        </div>
      </div>
      {hydrated.length ? (
        <div className="space-y-3">
          {hydrated.map((row, idx) => (
            <div key={`${row.questionId || idx}`} className="p-3 rounded-xl border border-slate-200 bg-slate-50">
              <div className="flex items-center justify-between">
                <div className="text-xs font-semibold text-indigo-700 uppercase tracking-wide">
                  {row.lessonTitle || row.lessonId || "lesson"}
                </div>
                {row.createdAt && (
                  <div className="text-[11px] text-slate-500">
                    {new Date(row.createdAt).toLocaleDateString()}
                  </div>
                )}
              </div>
              <p className="mt-2 text-sm text-slate-800 font-semibold">{row.prompt}</p>
              <p className="text-sm text-slate-600">
                Correct: <span className="font-semibold">{row.correctAnswer}</span>
              </p>
              {row.userAnswer && (
                <p className="text-sm text-slate-500">
                  Your answer: {row.userAnswer}
                </p>
              )}
              <div className="mt-2">
                <button
                  className="text-xs px-3 py-1.5 rounded bg-indigo-600 text-white hover:bg-indigo-700"
                  onClick={() => navigate(`/pronunciation?target=${encodeURIComponent(row.correctAnswer || row.prompt || "")}`)}
                >
                  practice in lab
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-slate-500">No curriculum mistakes yet.</p>
      )}
    </section>
  );
}
