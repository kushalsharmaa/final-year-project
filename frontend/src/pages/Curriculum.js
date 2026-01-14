// src/pages/Curriculum.js
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { auth, app } from "../firebase";
import { getFirestore, doc, getDoc } from "firebase/firestore";
import { CURRICULUM, ALL_LESSONS, LESSON_ORDER } from "../features/learning/curriculum";
import { DEFAULT_PROGRESS } from "../features/learning/progress";

export default function Curriculum() {
  const user = auth.currentUser;
  const navigate = useNavigate();
  const db = useMemo(() => getFirestore(app), []);

  const [progress, setProgress] = useState(DEFAULT_PROGRESS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let on = true;
    (async () => {
      if (!user) {
        setProgress(DEFAULT_PROGRESS);
        setLoading(false);
        return;
      }
      try {
        const ref = doc(db, "progress", user.uid);
        const snap = await getDoc(ref);
        if (!on) return;
        if (snap.exists()) {
          setProgress({ ...DEFAULT_PROGRESS, ...(snap.data() || {}) });
        } else {
          setProgress(DEFAULT_PROGRESS);
        }
      } catch (e) {
        if (!on) return;
        setProgress(DEFAULT_PROGRESS);
      } finally {
        if (on) setLoading(false);
      }
    })();
    return () => {
      on = false;
    };
  }, [db, user]);

  const completedLessons = progress?.completedLessons || {};

  const isUnlocked = (lessonId) => {
    const idx = LESSON_ORDER.indexOf(lessonId);
    if (idx <= 0) return true;
    const prevId = LESSON_ORDER[idx - 1];
    return !!completedLessons[prevId];
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900 flex items-center justify-center">
        <div className="text-sm text-slate-600">Loading curriculum…</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <header className="flex flex-col gap-2">
          <p className="text-xs uppercase tracking-[0.2em] text-indigo-500">
            Curriculum path
          </p>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
            Follow the structured path
          </h1>
          <p className="text-slate-600 max-w-3xl">
            Unlock lessons in order, build XP, and revisit completed topics any time.
          </p>
        </header>

        <div className="space-y-8">
          {Object.values(CURRICULUM).map((level) => (
            <section
              key={level.id}
              className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5 space-y-4"
            >
              <div className="flex items-baseline justify-between gap-3">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900">{level.title}</h2>
                  {level.description && (
                    <p className="text-sm text-slate-600 mt-1">{level.description}</p>
                  )}
                </div>
              </div>

              <div className="space-y-5">
                {level.units.map((unit) => (
                  <div
                    key={unit.id}
                    className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold text-slate-900">{unit.title}</h3>
                      <span className="text-xs uppercase text-slate-500">unit</span>
                    </div>
                    <div className="flex flex-wrap gap-3">
                      {unit.lessons.map((lesson) => {
                        const lessonFull = ALL_LESSONS[lesson.id] || lesson;
                        const completed = !!completedLessons[lesson.id];
                        const unlocked = completed || isUnlocked(lesson.id);
                        const state = completed ? "completed" : unlocked ? "unlocked" : "locked";
                        return (
                          <button
                            key={lesson.id}
                            disabled={!unlocked}
                            onClick={() => navigate(`/curriculum-lesson/${lesson.id}`)}
                            className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition ${
                              state === "completed"
                                ? "bg-emerald-600 text-white border-emerald-500 shadow-sm"
                                : state === "unlocked"
                                ? "bg-white text-slate-900 border-indigo-200 hover:border-indigo-300 hover:-translate-y-0.5 shadow-sm"
                                : "bg-white text-slate-400 border-slate-200 cursor-not-allowed"
                            }`}
                          >
                            <StateDot state={state} />
                            <div className="text-left">
                              <div className="font-semibold leading-tight">
                                {lesson.title}
                              </div>
                              <div className="text-[11px] text-slate-500">
                                {lessonFull.type} • {lessonFull.estimatedMinutes || 6} min
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </main>
    </div>
  );
}

function StateDot({ state }) {
  const colors = {
    completed: "bg-emerald-300",
    unlocked: "bg-indigo-300",
    locked: "bg-slate-300",
  };
  return <span className={`h-2.5 w-2.5 rounded-full ${colors[state] || colors.locked}`} />;
}
