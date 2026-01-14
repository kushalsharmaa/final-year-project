// src/pages/Learn.js
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { generateLessonPlan, getSummary } from "../lib/api";

const LEVELS = [
  { id: "a2", label: "A2 foundation" },
  { id: "b1", label: "B1 bridge" },
  { id: "b2", label: "B2 power" },
  { id: "c1", label: "C1 expert" },
];

const DURATIONS = [15, 20, 25, 30];

export default function Learn() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    goal: "Improve clarity and flow when I speak about work updates.",
    topic: "sharing project updates with a team",
    level: "b1",
    durationMinutes: 20,
    tone: "supportive",
    includePronunciation: true,
  });
  const [plan, setPlan] = useState(null);
  const [loadingPlan, setLoadingPlan] = useState(false);
  const [error, setError] = useState("");

  const [summary, setSummary] = useState(null);
  const [loadingSummary, setLoadingSummary] = useState(true);

  useEffect(() => {
    let on = true;
    (async () => {
      try {
        const data = await getSummary({ limit: 50 }).catch(() => null);
        if (!on) return;
        if (data) setSummary(data);
      } finally {
        if (on) setLoadingSummary(false);
      }
    })();
    return () => {
      on = false;
    };
  }, []);

  const suggestedWeakWords = useMemo(() => {
    const hardest = summary?.hardestWords || [];
    const fromItems =
      summary?.items?.flatMap((row) => row.hardWords || []) || [];
    const merged = [...hardest, ...fromItems].map((w) => String(w || "").trim());
    return Array.from(new Set(merged.filter(Boolean))).slice(0, 6);
  }, [summary]);

  const pronunciationTargets = useMemo(() => {
    if (suggestedWeakWords.length >= 2) {
      return [
        `I need to practise the words ${suggestedWeakWords
          .slice(0, 2)
          .join(" and ")} today.`,
        `Please repeat after me: ${suggestedWeakWords.slice(0, 3).join(", ")}.`,
      ];
    }
    return [];
  }, [suggestedWeakWords]);

  async function handleGenerate() {
    setLoadingPlan(true);
    setError("");
    try {
      const payload = {
        ...form,
        weakWords: suggestedWeakWords,
        weakPronunciation: form.includePronunciation
          ? pronunciationTargets
          : [],
      };
      const data = await generateLessonPlan(payload);
      setPlan(data.plan || null);
    } catch (e) {
      setError(e.message || "Could not generate a lesson.");
    } finally {
      setLoadingPlan(false);
    }
  }

  const practiceTarget =
    plan?.pronunciationTargets?.[0] ||
    plan?.vocabulary?.[0]?.phrase ||
    plan?.topic ||
    "";

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-indigo-50/30 to-white text-slate-900">
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-indigo-500">
              ai lesson coach
            </p>
            <h1 className="mt-2 text-3xl sm:text-4xl font-bold tracking-tight">
              AI coach for personalised lessons
            </h1>
            <p className="mt-2 text-slate-600 max-w-2xl">
              Generate a smart lesson from your goals and weak words. The coach
              assembles prompts, drills, and pronunciation targets you can send
              straight into the lab.
            </p>
            <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-600">
              <Tag tone="indigo">Pronunciation-focused</Tag>
              <Tag tone="emerald">Uses your recent weak words</Tag>
              <Tag tone="slate">LLM-backed when configured</Tag>
            </div>
          </div>
          <div className="bg-white border border-slate-200 rounded-2xl px-4 py-3 shadow-sm">
            <p className="text-xs text-slate-500">Need a quick practice?</p>
            <div className="flex items-center gap-3 mt-1">
              <button
                onClick={() =>
                  navigate(
                    `/pronunciation${
                      practiceTarget
                        ? `?target=${encodeURIComponent(practiceTarget)}`
                        : ""
                    }`
                  )
                }
                disabled={!practiceTarget}
                className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Open pronunciation lab
                <span className="text-xs font-normal">
                  {practiceTarget ? "prefill target" : "target later"}
                </span>
              </button>
              {plan?.durationMinutes && (
                <div className="text-sm text-slate-700">
                  {plan.durationMinutes} min plan
                </div>
              )}
            </div>
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-[1.05fr_1fr]">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5 space-y-4">
            <h2 className="text-lg font-semibold text-slate-900">
              Describe your lesson
            </h2>
            <div className="space-y-3">
              <FieldLabel label="Goal">
                <textarea
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
                  rows={3}
                  value={form.goal}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, goal: e.target.value }))
                  }
                  placeholder="e.g., speak clearly about my project status without rushing"
                />
              </FieldLabel>
              <FieldLabel label="Context / topic">
                <input
                  type="text"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
                  value={form.topic}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, topic: e.target.value }))
                  }
                  placeholder="e.g., weekly standup, job interview, travel"
                />
              </FieldLabel>
              <div className="grid sm:grid-cols-2 gap-3">
                <FieldLabel label="Level">
                  <div className="flex flex-wrap gap-2">
                    {LEVELS.map((lvl) => (
                      <button
                        key={lvl.id}
                        onClick={() =>
                          setForm((f) => ({ ...f, level: lvl.id }))
                        }
                        className={`px-3 py-2 rounded-lg border text-sm ${
                          form.level === lvl.id
                            ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                            : "border-slate-200 hover:border-slate-300 text-slate-700"
                        }`}
                      >
                        {lvl.label}
                      </button>
                    ))}
                  </div>
                </FieldLabel>
                <FieldLabel label="Session length">
                  <div className="flex flex-wrap gap-2">
                    {DURATIONS.map((min) => (
                      <button
                        key={min}
                        onClick={() =>
                          setForm((f) => ({ ...f, durationMinutes: min }))
                        }
                        className={`px-3 py-2 rounded-lg border text-sm ${
                          form.durationMinutes === min
                            ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                            : "border-slate-200 hover:border-slate-300 text-slate-700"
                        }`}
                      >
                        {min} min
                      </button>
                    ))}
                  </div>
                </FieldLabel>
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                <FieldLabel label="Tone">
                  <select
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
                    value={form.tone}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, tone: e.target.value }))
                    }
                  >
                    <option value="supportive">Supportive coach</option>
                    <option value="direct">Direct and concise</option>
                    <option value="energetic">Energetic and encouraging</option>
                  </select>
                </FieldLabel>
                <FieldLabel label="Pronunciation focus">
                  <div className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2">
                    <span className="text-sm text-slate-700">
                      Add drills and phrase targets
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setForm((f) => ({
                          ...f,
                          includePronunciation: !f.includePronunciation,
                        }))
                      }
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                        form.includePronunciation
                          ? "bg-indigo-500"
                          : "bg-slate-300"
                      }`}
                      aria-pressed={form.includePronunciation}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition ${
                          form.includePronunciation
                            ? "translate-x-5"
                            : "translate-x-1"
                        }`}
                      />
                    </button>
                  </div>
                </FieldLabel>
              </div>

              <HintCard
                loading={loadingSummary}
                words={suggestedWeakWords}
                onSelect={(w) =>
                  setForm((f) => ({
                    ...f,
                    goal: f.goal.includes(w) ? f.goal : `${f.goal} Focus on "${w}".`,
                  }))
                }
              />

              {error && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                  {error}
                </div>
              )}

              <div className="flex items-center gap-3">
                <button
                  onClick={handleGenerate}
                  disabled={loadingPlan}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  {loadingPlan ? "Generating..." : "Generate AI lesson"}
                </button>
                <p className="text-xs text-slate-500">
                  Uses your weak words when available.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            {plan ? (
              <PlanView plan={plan} navigate={navigate} />
            ) : (
              <EmptyPlan />
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

function PlanView({ plan, navigate }) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase text-slate-500">Preview</p>
          <h2 className="text-2xl font-bold text-slate-900 leading-tight">
            {plan.title || "Personalised lesson"}
          </h2>
          <p className="text-sm text-slate-600 mt-1">
            {plan.goal || "A focused speaking session."}
          </p>
          <div className="flex flex-wrap gap-2 mt-2">
            {plan.level && <Chip label={plan.level.toUpperCase()} tone="indigo" />}
            {plan.topic && <Chip label={plan.topic} tone="slate" />}
            {plan.durationMinutes && (
              <Chip label={`${plan.durationMinutes} min`} tone="emerald" />
            )}
          </div>
        </div>
        {plan.generatedAt && (
          <div className="text-xs text-slate-500">
            {new Date(plan.generatedAt).toLocaleString()}
          </div>
        )}
      </div>

      {plan.vocabulary && plan.vocabulary.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs uppercase text-slate-500 mb-2">Key words</p>
          <div className="flex flex-wrap gap-2">
            {plan.vocabulary.map((v) => (
              <Chip key={v.phrase} label={v.phrase} tone="slate" detail={v.tip} />
            ))}
          </div>
        </div>
      )}

      <div className="space-y-3">
        {(plan.sections || []).map((section) => (
          <SectionCard key={section.id || section.title} section={section} />
        ))}
      </div>

      {plan.pronunciationTargets && plan.pronunciationTargets.length > 0 && (
        <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-indigo-900">
              Pronunciation targets
            </h3>
            <button
              onClick={() =>
                navigate(
                  `/pronunciation?target=${encodeURIComponent(
                    plan.pronunciationTargets[0]
                  )}`
                )
              }
              className="text-xs font-semibold text-indigo-700 hover:text-indigo-900"
            >
              Send to lab
            </button>
          </div>
          <ul className="mt-2 space-y-1 text-sm text-indigo-900/90">
            {plan.pronunciationTargets.map((t, idx) => (
              <li key={idx} className="flex gap-2">
                <span className="text-indigo-500">•</span>
                <span>{t}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function SectionCard({ section }) {
  return (
    <div className="rounded-xl border border-slate-200 p-3 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase text-slate-500">{section.type}</p>
          <h4 className="text-lg font-semibold text-slate-900">
            {section.title}
          </h4>
        </div>
        {section.duration && (
          <span className="text-xs text-slate-500">{section.duration} min</span>
        )}
      </div>
      {section.summary && (
        <p className="text-sm text-slate-600 mt-1">{section.summary}</p>
      )}

      {section.tasks && section.tasks.length > 0 && (
        <ul className="mt-2 space-y-1 text-sm text-slate-700">
          {section.tasks.map((t, idx) => (
            <li key={idx} className="flex gap-2">
              <span className="text-slate-400">•</span>
              <span>{t}</span>
            </li>
          ))}
        </ul>
      )}

      {section.prompt && (
        <div className="mt-2 rounded-lg border border-indigo-100 bg-indigo-50 px-3 py-2 text-sm text-indigo-900">
          {section.prompt}
        </div>
      )}

      {section.rubric && section.rubric.length > 0 && (
        <div className="mt-2 grid sm:grid-cols-2 gap-2">
          {section.rubric.map((r, idx) => (
            <div
              key={idx}
              className="rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm text-emerald-900"
            >
              <div className="font-semibold">{r.label}</div>
              <div className="text-sm text-emerald-900/80">{r.detail}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function EmptyPlan() {
  return (
    <div className="h-full rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-center flex flex-col items-center justify-center">
      <div className="text-2xl">🧠</div>
      <h3 className="mt-2 text-lg font-semibold text-slate-900">
        No plan yet
      </h3>
      <p className="text-sm text-slate-600 max-w-sm">
        Set your goal and hit “Generate AI lesson.” We’ll build a tight session
        you can practise right away.
      </p>
    </div>
  );
}

function HintCard({ loading, words, onSelect }) {
  if (loading) {
    return (
      <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
        Pulling your recent weak words…
      </div>
    );
  }
  if (!words || words.length === 0) {
    return (
      <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
        We’ll still generate a plan even without past attempts.
      </div>
    );
  }
  return (
    <div className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-3">
      <p className="text-sm font-semibold text-indigo-900">
        Suggested focus from your attempts
      </p>
      <div className="flex flex-wrap gap-2 mt-2">
        {words.map((w) => (
          <button
            key={w}
            onClick={() => onSelect && onSelect(w)}
            className="px-3 py-1.5 rounded-full bg-white border border-indigo-200 text-indigo-800 text-sm hover:border-indigo-300"
          >
            {w}
          </button>
        ))}
      </div>
      <p className="text-xs text-indigo-800/80 mt-2">
        Tap to weave a word into your goal statement.
      </p>
    </div>
  );
}

function Chip({ label, detail, tone = "slate" }) {
  const tones = {
    indigo: "bg-indigo-50 text-indigo-800 border-indigo-200",
    emerald: "bg-emerald-50 text-emerald-800 border-emerald-200",
    slate: "bg-slate-100 text-slate-800 border-slate-200",
  };
  return (
    <span
      className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border text-xs font-semibold ${tones[tone] || tones.slate}`}
      title={detail || ""}
    >
      {label}
    </span>
  );
}

function Tag({ children, tone = "slate" }) {
  const tones = {
    indigo: "bg-indigo-50 text-indigo-700 border-indigo-200",
    emerald: "bg-emerald-50 text-emerald-700 border-emerald-200",
    slate: "bg-slate-100 text-slate-700 border-slate-200",
  };
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-1 rounded-full border text-[11px] font-semibold ${tones[tone] || tones.slate}`}
    >
      {children}
    </span>
  );
}

function FieldLabel({ label, children }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs uppercase text-slate-500">{label}</span>
      {children}
    </label>
  );
}
