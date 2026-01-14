// src/pages/Drill.js
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getSummary } from "../lib/api";

const FALLBACK_SENTENCES = [
  "Please practice hello again.",
  "I always forget thank you.",
  "Can you repeat that sentence slowly?",
];

function buildDrills(summary) {
  const drills = [];
  const items = summary?.items || [];

  if (summary?.suggestedPhrases?.length) {
    summary.suggestedPhrases.slice(0, 5).forEach((p) => {
      drills.push({ text: p, source: "suggested phrase" });
    });
  }

  if (!drills.length && summary?.hardestWords?.length) {
    summary.hardestWords.slice(0, 5).forEach((w) => {
      drills.push({ text: `Please practice ${w} again.`, source: "hard word" });
    });
  }

  // Attach lesson info if available
  const withMeta = drills.map((d) => {
    const match = items.find((it) => it.target && d.text && it.target.includes(d.text));
    return {
      ...d,
      level: match?.level || null,
      lessonId: match?.lessonId || null,
    };
  });

  if (withMeta.length) return withMeta.slice(0, 5);

  return FALLBACK_SENTENCES.map((text, idx) => ({
    text,
    source: "starter",
    level: null,
    lessonId: null,
    id: `fallback-${idx}`,
  }));
}

export default function Drill() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [drills, setDrills] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let on = true;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const data = await getSummary({ limit: 50 });
        if (!on) return;
        setDrills(buildDrills(data));
      } catch (e) {
        if (!on) return;
        setError("Could not load your drill. Using a starter set.");
        setDrills(buildDrills({}));
      } finally {
        if (on) setLoading(false);
      }
    })();
    return () => { on = false; };
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      <main className="max-w-4xl mx-auto p-6 space-y-5">
        <header>
          <p className="text-sm text-slate-500">drill</p>
          <h1 className="text-3xl font-bold text-slate-900">Short speaking drill</h1>
          <p className="text-slate-600 mt-1">
            Three very short lines you can speak right now.
          </p>
        </header>

        {loading && (
          <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-600">
            Loading your drill...
          </div>
        )}

        {error && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-800 text-sm">
            {error}
          </div>
        )}

        {!loading && (
          <section className="space-y-3">
            {drills.map((d, idx) => (
              <div
                key={d.id || d.text || idx}
                className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 rounded-2xl border border-slate-200 bg-white shadow-sm"
              >
                <div>
                  <div className="text-xs uppercase text-indigo-700 font-semibold tracking-wide">
                    {d.lessonId ? `from lesson ${d.lessonId}` : d.level ? `level ${d.level}` : d.source || "lab"}
                  </div>
                  <p className="text-base font-semibold text-slate-900">{d.text}</p>
                </div>
                <button
                  className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm hover:bg-indigo-700"
                  onClick={() => navigate(`/pronunciation?target=${encodeURIComponent(d.text)}`)}
                >
                  practice in lab
                </button>
              </div>
            ))}
          </section>
        )}

        <div className="pt-2">
          <button
            className="w-full sm:w-auto px-4 py-2 rounded-lg border bg-white hover:bg-slate-50 text-sm"
            onClick={() => navigate("/pronunciation")}
          >
            Open pronunciation lab
          </button>
        </div>
      </main>
    </div>
  );
}
