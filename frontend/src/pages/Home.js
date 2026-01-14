// src/pages/Home.js
import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { auth, app } from "../firebase";
import { getSummary, getStudySummary } from "../lib/api";
import { getFirestore, doc, getDoc, setDoc } from "firebase/firestore";
import { ALL_LESSONS, LESSON_ORDER } from "../features/learning/curriculum";
import {
  getProgress,
  pickNextLesson,
  DEFAULT_PROGRESS,
} from "../features/learning/progress";
import {
  ChevronRightIcon,
  ClockIcon,
  FireIcon,
  MicrophoneIcon,
  SparklesIcon,
  AcademicCapIcon,
  ClipboardDocumentCheckIcon,
  BoltIcon,
} from "@heroicons/react/24/solid";

const mockRecommendedLessons = [
  {
    id: "a1_1_1_greetings",
    title: "First greetings",
    description: "Learn hello, how are you and simple friendly lines.",
    level: "A1",
    type: "vocabulary",
    duration: "5 min",
  },
  {
    id: "a1_1_2_names",
    title: "Talking about your name",
    description: "Ask and answer what is your name in natural way.",
    level: "A1",
    type: "speaking",
    duration: "6 min",
  },
  {
    id: "a1_1_3_polite",
    title: "Polite words please and thank you",
    description: "Use please, thank you and excuse me in daily life.",
    level: "A1",
    type: "vocabulary",
    duration: "7 min",
  },
  {
    id: "a1_2_1_family_words",
    title: "Family words",
    description: "Mother, father, sister and more family words.",
    level: "A1",
    type: "vocabulary",
    duration: "8 min",
  },
];

const mockPronunciationPhrase = {
  id: "phrase_123",
  text: "The board of directors carefully reviewed the quarterly report.",
};

const defaultStats = {
  totalAttempts: 0,
  avgAccuracy: 0,
  weeklyMinutes: 0,
  dailyAttempts: 0,
  streakDays: 0,
};

function dayKey(ts) {
  if (!ts) return null;
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function computeStreak(items = []) {
  const days = new Set(
    items.map((i) => dayKey(i.createdAt)).filter(Boolean)
  );
  let streak = 0;
  const cursor = new Date();
  while (true) {
    const key = cursor.toISOString().slice(0, 10);
    if (days.has(key)) {
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
    } else {
      break;
    }
  }
  return streak;
}

function computeStatsFromSummary(summary) {
  const items = summary?.items || [];
  const totalAttempts = Number(summary?.count || items.length || 0);
  const avgAccuracy =
    summary?.avgAccuracy != null
      ? Math.round(Number(summary.avgAccuracy) * 100)
      : 0;

  const now = new Date();
  const todayKey = now.toISOString().slice(0, 10);
  const weekStart = new Date();
  weekStart.setDate(now.getDate() - 6);

  let weeklySeconds = 0;
  let dailyAttempts = 0;
  items.forEach((item) => {
    const key = dayKey(item.createdAt);
    if (!key) return;
    const dt = new Date(key);
    if (key === todayKey) dailyAttempts += 1;
    if (dt >= weekStart) {
      weeklySeconds += Number(item.duration || 0);
    }
  });
  const weeklyMinutes = Math.max(0, Math.round(weeklySeconds / 60));

  const streakDays =
    summary?.streakDays != null
      ? Number(summary.streakDays)
      : computeStreak(items);

  return {
    totalAttempts,
    avgAccuracy,
    weeklyMinutes,
    dailyAttempts,
    streakDays,
  };
}

function extractLastAccuracy(summary) {
  const items = summary?.items || [];
  const recentItem = items.find((row) => typeof row.accuracy === "number");
  if (recentItem) return Math.round(recentItem.accuracy * 100);
  if (Array.isArray(summary?.recent) && summary.recent.length) {
    return Math.round(Number(summary.recent[0]));
  }
  if (typeof summary?.avgAccuracy === "number")
    return Math.round(summary.avgAccuracy * 100);
  return null;
}

function buildPreviewLessons(progress, nextLessonId) {
  const order = LESSON_ORDER;
  const idx = nextLessonId ? order.indexOf(nextLessonId) : 0;
  const previewIds = [];
  if (nextLessonId) previewIds.push(nextLessonId);
  if (order[idx + 1]) previewIds.push(order[idx + 1]);
  if (progress.lastLessonId && !previewIds.includes(progress.lastLessonId)) {
    previewIds.push(progress.lastLessonId);
  }
  return previewIds
    .map((id) => ALL_LESSONS[id])
    .filter(Boolean)
    .slice(0, 3);
}

// main component
export default function Home() {
  const user = auth.currentUser;
  const userName =
    user?.displayName || user?.email?.split("@")[0] || "Learner";
  const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
  const navigate = useNavigate();
  const db = useMemo(() => getFirestore(app), []);

  const [loadingSummary, setLoadingSummary] = useState(true);
  const [stats, setStats] = useState(defaultStats);
  const [summaryError, setSummaryError] = useState("");
  const [summaryData, setSummaryData] = useState(null);
  const [lastAccuracy, setLastAccuracy] = useState(null);
  const [weeklyGoal, setWeeklyGoal] = useState(120);
  const [goalSaved, setGoalSaved] = useState(false);
  const [savingGoal, setSavingGoal] = useState(false);
  const [progress, setProgress] = useState(DEFAULT_PROGRESS);
  const [nextLesson, setNextLesson] = useState(null);
  const [previewLessons, setPreviewLessons] = useState([]);
  const [studyTag, setStudyTag] = useState("prem");
  const [studyStats, setStudyStats] = useState(null);
  const [studyLoading, setStudyLoading] = useState(false);
  const [studyError, setStudyError] = useState("");

  useEffect(() => {
    let on = true;
    (async () => {
      setLoadingSummary(true);
      setSummaryError("");
      try {
        const data = await getSummary({ limit: 100 });
        if (!on) return;
        setStats(computeStatsFromSummary(data));
        setSummaryData(data);
        setLastAccuracy(extractLastAccuracy(data));
      } catch (e) {
        if (!on) return;
        setSummaryError("Could not load your progress yet.");
        setStats(defaultStats);
        setLastAccuracy(null);
      } finally {
        if (on) setLoadingSummary(false);
      }
    })();
    return () => {
      on = false;
    };
  }, [user]);

  useEffect(() => {
    let on = true;
    (async () => {
      try {
        const prog = await getProgress(user);
        if (!on) return;
        setProgress(prog);
        const nextId = pickNextLesson(prog, LESSON_ORDER);
        setNextLesson(nextId ? ALL_LESSONS[nextId] : null);
        setPreviewLessons(buildPreviewLessons(prog, nextId));
      } catch (e) {
        if (!on) return;
      }
    })();
    return () => {
      on = false;
    };
  }, [user, summaryData]);

  useEffect(() => {
    let on = true;
    (async () => {
      if (!user) return;
      try {
        const ref = doc(db, "userProfile", user.uid);
        const snap = await getDoc(ref);
        if (!snap.exists()) {
          await setDoc(
            ref,
            { weeklyMinutesGoal: 120 },
            { merge: true }
          );
          if (on) setWeeklyGoal(120);
        } else {
          const val = Number(snap.data()?.weeklyMinutesGoal || 120);
          if (on) setWeeklyGoal(val > 0 ? val : 120);
        }
      } catch {
        if (on) setWeeklyGoal(120);
      }
    })();
    return () => {
      on = false;
    };
  }, [db, user]);

  const handleGoalChange = async (value) => {
    if (!user) return;
    const clean = Math.max(30, Math.min(600, Number(value) || 120));
    setWeeklyGoal(clean);
    setSavingGoal(true);
    setGoalSaved(false);
    try {
      const ref = doc(db, "userProfile", user.uid);
      await setDoc(ref, { weeklyMinutesGoal: clean }, { merge: true });
      setGoalSaved(true);
      setTimeout(() => setGoalSaved(false), 1500);
    } catch (e) {
      setSummaryError("Could not save goal right now.");
    } finally {
      setSavingGoal(false);
    }
  };

  const lessonPreview = mockRecommendedLessons.slice(0, 3);

  const downloadCsv = (filename, rows) => {
    if (!rows?.length) return;
    const keys = Object.keys(rows[0]);
    const escape = (val) => {
      const s = String(val ?? "");
      if (/[",\n]/.test(s)) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    };
    const csv = [
      keys.join(","),
      ...rows.map((r) => keys.map((k) => escape(r[k])).join(",")),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const exportStudySummary = () => {
    if (!studyStats) return;
    const row = {
      tag: studyStats.tag,
      attemptsCount: studyStats.attemptsCount,
      avgAccuracy: studyStats.avgAccuracy,
      avgWer: studyStats.avgWer,
      avgLatencyMs: studyStats.avgLatencyMs,
      avgServerLatencyMs: studyStats.avgServerLatencyMs,
      passThreshold: studyStats.passThreshold,
      passCount: studyStats.passCount,
      accuracyFirstHalf: studyStats.accuracyFirstHalf,
      accuracySecondHalf: studyStats.accuracySecondHalf,
      accuracyDelta: studyStats.accuracyDelta,
      werFirstHalf: studyStats.werFirstHalf,
      werSecondHalf: studyStats.werSecondHalf,
      werDelta: studyStats.werDelta,
      errorCounts: JSON.stringify(studyStats.errorCounts || {}),
      hardWordsTop: JSON.stringify(studyStats.hardWordsTop || []),
      feedbackAverages: JSON.stringify(studyStats.feedback || {}),
      issues: JSON.stringify(studyStats.issues || {}),
    };
    downloadCsv(`study_summary_${studyStats.tag || "tag"}.csv`, [row]);
  };

  const exportStudyFeedback = () => {
    if (!studyStats?.feedbackRows?.length) return;
    const rows = studyStats.feedbackRows.map((r) => ({
      tag: studyStats.tag,
      createdAt: r.createdAt,
      usability: r.usability,
      feedback: r.feedback,
      speed: r.speed,
      satisfaction: r.satisfaction,
      personalization: r.personalization,
      clarity: r.clarity,
      issues: JSON.stringify(r.issues || []),
      comment: r.comment,
      lastTarget: r.lastTarget,
    }));
    downloadCsv(`study_feedback_${studyStats.tag || "tag"}.csv`, rows);
  };

  const loadStudyStats = async () => {
    setStudyError("");
    if (!user) {
      setStudyError("log in to load study stats.");
      return;
    }
    if (!studyTag.trim()) {
      setStudyError("set a study tag first.");
      return;
    }
    try {
      setStudyLoading(true);
      const data = await getStudySummary({ tag: studyTag.trim() });
      setStudyStats(data);
    } catch (e) {
      setStudyError("could not load study stats.");
    } finally {
      setStudyLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800">
      <TopNav userName={cap(userName)} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* welcome */}
        <header className="flex flex-col gap-1">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-slate-500">
            Dashboard
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
            Welcome back, {cap(userName)}.
          </h1>
          <p className="mt-1 text-sm sm:text-base text-slate-600">
            Use the coach, curriculum and lab together to improve each day.
          </p>
        </header>

        {/* three main features at the top */}
        <FeatureTrio navigate={navigate} />

        {/* main grid */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 lg:gap-8">
          {/* left side */}
          <div className="xl:col-span-2 space-y-6 lg:space-y-7">
            <LearningPathPreview
              lessons={previewLessons.length ? previewLessons : lessonPreview}
              navigate={navigate}
            />
            <LabPreview navigate={navigate} phrase={mockPronunciationPhrase} />
            <QuickActions navigate={navigate} />
          </div>

          {/* right side */}
          <div className="space-y-6 lg:space-y-7">
            <StatsOverview
              stats={stats}
              loading={loadingSummary}
              lastAccuracy={lastAccuracy}
            />
            <StudyEvidenceCard
              tag={studyTag}
              onTagChange={setStudyTag}
              stats={studyStats}
              loading={studyLoading}
              error={studyError}
              onRefresh={loadStudyStats}
              onExportSummary={exportStudySummary}
              onExportFeedback={exportStudyFeedback}
            />
            <WeeklyProgress
              current={stats.weeklyMinutes}
              goal={weeklyGoal}
              onGoalChange={handleGoalChange}
              saved={goalSaved}
              saving={savingGoal}
              loading={loadingSummary}
            />
            <CurriculumReportCard progress={progress} />
            {summaryError && (
              <Card>
                <p className="text-sm text-amber-700">
                  {summaryError}
                </p>
              </Card>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

// top nav
function TopNav({ userName }) {
  const navigate = useNavigate();

  const handleLogout = () => {
    auth.signOut().then(() => {
      navigate("/login");
    });
  };

  return (
    <header className="sticky top-0 z-40 bg-white/90 backdrop-blur border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="h-8 w-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center text-sm font-semibold">
            AI
          </div>
          <nav className="hidden md:flex items-center gap-5 text-sm font-medium text-slate-700">
            <Link to="/home" className="text-indigo-600">
              Home
            </Link>
            <Link
              to="/learn"
              className="hover:text-indigo-600 transition-colors"
            >
              AI coach
            </Link>
            <Link
              to="/curriculum"
              className="hover:text-indigo-600 transition-colors"
            >
              Curriculum
            </Link>
            <Link
              to="/pronunciation"
              className="hover:text-indigo-600 transition-colors"
            >
              Lab
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden sm:inline text-sm text-slate-700">
            Hi, {userName}
          </span>
          <button
            onClick={handleLogout}
            className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Logout
          </button>
        </div>
      </div>
    </header>
  );
}

// three main feature cards
function FeatureTrio({ navigate }) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Card>
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-lg bg-indigo-50">
            <MicrophoneIcon className="h-6 w-6 text-indigo-600" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              Pronunciation lab
            </h3>
            <p className="text-xs text-slate-500">
              Record, score and track your speaking attempts.
            </p>
          </div>
        </div>
        <button
          onClick={() => navigate("/pronunciation")}
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-medium text-white hover:bg-indigo-700"
        >
          Open lab
          <ChevronRightIcon className="h-4 w-4" />
        </button>
      </Card>

      <Card>
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-lg bg-slate-50">
            <SparklesIcon className="h-6 w-6 text-slate-700" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              AI lesson coach
            </h3>
            <p className="text-xs text-slate-500">
              Generate a fresh lesson from your goals and weak words.
            </p>
          </div>
        </div>
        <button
          onClick={() => navigate("/learn")}
          className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-xs font-medium text-white hover:bg-slate-800"
        >
          Open coach
          <ChevronRightIcon className="h-4 w-4" />
        </button>
      </Card>

      <Card>
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-lg bg-emerald-50">
            <AcademicCapIcon className="h-6 w-6 text-emerald-600" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              Curriculum path
            </h3>
            <p className="text-xs text-slate-500">
              Move through units from starter topics to advanced.
            </p>
          </div>
        </div>
        <button
          onClick={() => navigate("/curriculum")}
          className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-medium text-white hover:bg-emerald-700"
        >
          View path
          <ChevronRightIcon className="h-4 w-4" />
        </button>
      </Card>
    </div>
  );
}

// small preview of curriculum path lessons
function LearningPathPreview({ lessons, navigate }) {
  const items = lessons || [];
  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-1.5 bg-slate-100 rounded-lg">
            <AcademicCapIcon className="h-5 w-5 text-slate-700" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              Curriculum preview
            </h2>
            <p className="text-xs text-slate-500">
              Next lessons from your structured path.
            </p>
          </div>
        </div>
        <button
          onClick={() => navigate("/curriculum")}
          className="text-xs font-medium text-indigo-600 hover:text-indigo-800"
        >
          Open curriculum
        </button>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        {items.map((lesson) => (
          <button
            key={lesson.id}
            onClick={() => navigate(`/curriculum-lesson/${lesson.id}`)}
            className="flex flex-col items-start rounded-xl bg-white border border-slate-200 px-4 py-3 text-left hover:border-indigo-200 hover:shadow-sm transition-all"
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-700">
                {lesson.levelTitle || lesson.level || ""}
              </span>
              <span className="text-[10px] text-slate-400 uppercase tracking-wide">
                {lesson.type} • {lesson.estimatedMinutes || lesson.duration || "5"} min •{" "}
                {lesson.xpReward || 10} xp
              </span>
            </div>
            <p className="text-sm font-semibold text-slate-900 line-clamp-2">
              {lesson.title}
            </p>
            <p className="mt-1 text-xs text-slate-600 line-clamp-3">
              {lesson.description}
            </p>
          </button>
        ))}
      </div>
    </Card>
  );
}

// pronunciation lab snapshot
function LabPreview({ navigate, phrase }) {
  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-1.5 bg-slate-100 rounded-lg">
            <MicrophoneIcon className="h-5 w-5 text-slate-700" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              Pronunciation lab snapshot
            </h2>
            <p className="text-xs text-slate-500">
              One sentence ready to practice today.
            </p>
          </div>
        </div>
        <button
          onClick={() =>
            navigate(
              `/pronunciation?target=${encodeURIComponent(phrase.text)}`
            )
          }
          className="text-xs font-medium text-indigo-600 hover:text-indigo-800"
        >
          Open lab
        </button>
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
        <p className="text-[11px] text-slate-500 mb-1 uppercase tracking-wide">
          Sample for today
        </p>
        <p className="text-sm font-medium text-slate-800">
          "{phrase.text}"
        </p>
      </div>

      <ul className="mt-3 text-xs text-slate-600 space-y-1">
        <li>Read it slowly and listen to each sound.</li>
        <li>Record it in the lab and check weak words.</li>
        <li>Save hard words and revisit them in the curriculum.</li>
      </ul>
    </Card>
  );
}

// quick actions card (review, quiz, drill)
function QuickActions({ navigate }) {
  const rows = [
    {
      id: "review",
      title: "Review past mistakes",
      desc: "Look back at weak sentences and words from the lab.",
      action: "/review",
      icon: <BoltIcon className="h-5 w-5 text-amber-500" />,
    },
    {
      id: "quiz",
      title: "Quick five minute quiz",
      desc: "Short vocabulary check based on your history.",
      action: "/quiz",
      icon: (
        <ClipboardDocumentCheckIcon className="h-5 w-5 text-indigo-500" />
      ),
    },
    {
      id: "drill",
      title: "Short speaking drill",
      desc: "Three ready lines to speak and record.",
      action: "/drill",
      icon: <MicrophoneIcon className="h-5 w-5 text-emerald-500" />,
    },
  ];
  return (
    <Card>
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">
            Quick actions
          </p>
          <h2 className="text-sm font-semibold text-slate-900">
            Try these next
          </h2>
        </div>
      </div>
      <ul className="space-y-2">
        {rows.map((row) => (
          <li key={row.id}>
            <button
              type="button"
              onClick={() => navigate(row.action)}
              className="w-full text-left flex items-center gap-3 p-3 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 transition-all"
            >
              <div className="h-8 w-8 rounded-lg bg-white border border-slate-200 grid place-items-center">
                {row.icon}
              </div>
              <div className="flex-1">
                <div className="text-sm font-semibold text-slate-900">
                  {row.title}
                </div>
                <div className="text-xs text-slate-600">{row.desc}</div>
              </div>
              <ChevronRightIcon className="h-4 w-4 text-slate-400" />
            </button>
          </li>
        ))}
      </ul>
    </Card>
  );
}

// right column cards
function StatsOverview({ stats, loading, lastAccuracy }) {
  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-slate-900">
          Your progress
        </h2>
        <span className="text-[11px] uppercase tracking-[0.2em] text-slate-400">
          Live
        </span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <StatItem
          icon={<FireIcon className="h-5 w-5 text-orange-500" />}
          label="Attempts"
          value={loading ? "…" : stats.totalAttempts || 0}
          unit="total"
        />
        <StatItem
          icon={<MicrophoneIcon className="h-5 w-5 text-indigo-500" />}
          label="Today"
          value={loading ? "…" : stats.dailyAttempts || 0}
          unit="tries"
        />
        <StatItem
          icon={<ClockIcon className="h-5 w-5 text-sky-500" />}
          label="Week"
          value={loading ? "…" : stats.weeklyMinutes || 0}
          unit="mins"
        />
        <StatItem
          icon={<SparklesIcon className="h-5 w-5 text-emerald-500" />}
          label="Accuracy"
          value={loading ? "…" : stats.avgAccuracy || 0}
          unit="%"
        />
        <StatItem
          icon={<FireIcon className="h-5 w-5 text-rose-500" />}
          label="Streak"
          value={loading ? "…" : stats.streakDays || 0}
          unit="days"
        />
      </div>
      <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 flex items-center justify-between text-sm">
        <div className="text-slate-600">Last lab score</div>
        <div className="font-semibold text-slate-900">
          {loading
            ? "…"
            : lastAccuracy != null
            ? `${lastAccuracy} percent`
            : "No attempts yet"}
        </div>
      </div>
    </Card>
  );
}

function StatItem({ icon, label, value, unit }) {
  return (
    <div className="flex flex-col items-center text-center p-3 rounded-lg border border-slate-200 bg-slate-50">
      <div className="h-8 w-8 flex items-center justify-center bg-white border border-slate-200 rounded-full mb-1.5">
        {icon}
      </div>
      <p className="text-lg font-semibold text-slate-900">{value}</p>
      <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">
        {label} {unit}
      </p>
    </div>
  );
}

function WeeklyProgress({
  current,
  goal,
  onGoalChange,
  saved,
  saving,
  loading,
}) {
  const progress = goal ? Math.min((current / goal) * 100, 100) : 0;
  return (
    <Card>
      <div className="flex justify-between items-end mb-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">
            Weekly push
          </p>
          <h2 className="text-sm font-semibold text-slate-900">
            Minutes goal
          </h2>
        </div>
        <p className="text-sm font-medium text-slate-600">
          {loading ? "…" : current || 0}{" "}
          <span className="text-slate-400">/</span> {goal || 0} mins
        </p>
      </div>
      <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
        <div
          className="bg-indigo-500 h-full rounded-full transition-all duration-700 ease-out"
          style={{ width: `${progress || 0}%` }}
        />
      </div>
      <div className="mt-3 flex items-center gap-3 text-sm text-slate-700">
        <label htmlFor="weekly-goal-input" className="text-slate-700">
          Weekly goal
        </label>
        <input
          id="weekly-goal-input"
          type="number"
          min={30}
          max={600}
          value={goal || 0}
          onChange={(e) => {
            const next = Number(e.target.value);
            const safe = Number.isFinite(next)
              ? Math.max(30, Math.min(600, next))
              : goal;
            if (onGoalChange && safe !== goal) onGoalChange(safe);
          }}
          className="w-24 border border-slate-300 bg-white rounded px-2 py-1 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-200"
        />
        <span className="text-xs text-slate-500">
          {saving ? "Saving..." : saved ? "Goal saved" : ""}
        </span>
      </div>
      <p className="mt-2 text-xs text-slate-500">
        Aim to keep the bar above your target by the end of the week.
      </p>
    </Card>
  );
}

function CurriculumReportCard({ progress }) {
  const completed = Object.keys(progress?.completedLessons || {}).length;
  const percent = LESSON_ORDER.length
    ? Math.round((completed / LESSON_ORDER.length) * 100)
    : 0;
  const lastLessonId = progress?.lastLessonId;
  const lastLessonTitle =
    lastLessonId && ALL_LESSONS[lastLessonId]
      ? ALL_LESSONS[lastLessonId].title
      : "Not started";

  return (
    <Card>
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">
            Curriculum
          </p>
          <h3 className="text-lg font-semibold text-slate-900">
            Path report
          </h3>
        </div>
        <button
          className="text-xs font-semibold text-indigo-600 hover:text-indigo-800"
          onClick={() => (window.location.href = "/curriculum")}
        >
          View curriculum report
        </button>
      </div>
      <div className="space-y-2 text-sm text-slate-700">
        <div className="flex items-center justify-between">
          <span>Lessons completed</span>
          <span className="font-semibold text-slate-900">{completed}</span>
        </div>
        <div className="flex items-center justify-between">
          <span>Last lesson</span>
          <span className="font-semibold text-slate-900 text-right">
            {lastLessonTitle}
          </span>
        </div>
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span>Path completion</span>
            <span className="font-semibold text-slate-900">{percent}%</span>
          </div>
          <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
            <div
              className="h-full bg-indigo-500"
              style={{ width: `${Math.min(100, percent)}%` }}
            />
          </div>
        </div>
      </div>
    </Card>
  );
}

function Card({ children, className = "" }) {
  return (
    <section
      className={`bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-[0_2px_8px_-2px_rgba(0,0,0,0.04)] ${className}`}
    >
      {children}
    </section>
  );
}

function StudyEvidenceCard({
  tag,
  onTagChange,
  stats,
  loading,
  error,
  onRefresh,
  onExportSummary,
  onExportFeedback,
}) {
  return (
    <Card>
      <div className="flex items-center justify-between gap-3 mb-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Study evidence</h3>
          <p className="text-xs text-slate-500">Live Firestore metrics for a study tag.</p>
        </div>
        <button
          onClick={onRefresh}
          className="px-3 py-1.5 text-xs rounded border border-slate-300 bg-slate-50 hover:bg-slate-100"
          disabled={loading}
        >
          {loading ? "loading..." : "refresh"}
        </button>
      </div>

      <div className="flex items-center gap-2 mb-3">
        <input
          className="w-32 rounded border border-slate-300 px-2 py-1 text-sm"
          value={tag}
          onChange={(e) => onTagChange(e.target.value.trim())}
          placeholder="prem"
        />
        <button
          onClick={onExportSummary}
          className="px-2.5 py-1 text-xs rounded border border-slate-300 bg-white hover:bg-slate-50"
          disabled={!stats}
        >
          export summary CSV
        </button>
        <button
          onClick={onExportFeedback}
          className="px-2.5 py-1 text-xs rounded border border-slate-300 bg-white hover:bg-slate-50"
          disabled={!stats?.feedbackRows?.length}
        >
          export feedback CSV
        </button>
      </div>

      {error && <div className="text-xs text-rose-700 mb-2">{error}</div>}

      {stats ? (
        <div className="space-y-3 text-sm text-slate-700">
          <div className="grid gap-2 sm:grid-cols-2">
            <div>attempts: <strong>{stats.attemptsCount ?? 0}</strong></div>
            <div>avg accuracy: <strong>{typeof stats.avgAccuracy === "number" ? `${Math.round(stats.avgAccuracy * 100)}%` : "—"}</strong></div>
            <div>avg WER: <strong>{typeof stats.avgWer === "number" ? stats.avgWer.toFixed(3) : "—"}</strong></div>
            <div>avg latency: <strong>{typeof stats.avgLatencyMs === "number" ? `${Math.round(stats.avgLatencyMs)} ms` : "—"}</strong></div>
            <div>pass rate ≥ {stats.passThreshold ?? 0.8}: <strong>{typeof stats.passCount === "number" && typeof stats.attemptsCount === "number" && stats.attemptsCount > 0 ? `${Math.round((stats.passCount / stats.attemptsCount) * 100)}%` : "—"}</strong></div>
            <div>accuracy delta: <strong>{typeof stats.accuracyDelta === "number" ? stats.accuracyDelta.toFixed(3) : "—"}</strong></div>
          </div>

          <div>
            <div className="text-xs uppercase tracking-wide text-slate-500 mb-1">error counts</div>
            <div className="flex flex-wrap gap-2 text-xs">
              {Object.entries(stats.errorCounts || {}).map(([k, v]) => (
                <span key={k} className="px-2 py-1 rounded bg-slate-100 border border-slate-200">{k}: {v}</span>
              ))}
              {!Object.keys(stats.errorCounts || {}).length && (
                <span className="text-slate-500">no error data</span>
              )}
            </div>
          </div>

          <div>
            <div className="text-xs uppercase tracking-wide text-slate-500 mb-1">top hard words</div>
            <div className="flex flex-wrap gap-2 text-xs">
              {(stats.hardWordsTop || []).map((row) => (
                <span key={row.word} className="px-2 py-1 rounded bg-slate-100 border border-slate-200">{row.word} ×{row.count}</span>
              ))}
              {!stats.hardWordsTop?.length && (
                <span className="text-slate-500">no hard words</span>
              )}
            </div>
          </div>

          <div>
            <div className="text-xs uppercase tracking-wide text-slate-500 mb-1">feedback averages</div>
            <div className="grid gap-1 sm:grid-cols-3 text-xs">
              <span>usability: <strong>{stats.feedback?.usability?.toFixed?.(2) ?? "—"}</strong></span>
              <span>helpfulness: <strong>{stats.feedback?.feedback?.toFixed?.(2) ?? "—"}</strong></span>
              <span>speed: <strong>{stats.feedback?.speed?.toFixed?.(2) ?? "—"}</strong></span>
              <span>satisfaction: <strong>{stats.feedback?.satisfaction?.toFixed?.(2) ?? "—"}</strong></span>
              <span>personalization: <strong>{stats.feedback?.personalization?.toFixed?.(2) ?? "—"}</strong></span>
              <span>clarity: <strong>{stats.feedback?.clarity?.toFixed?.(2) ?? "—"}</strong></span>
            </div>
          </div>

          <div>
            <div className="text-xs uppercase tracking-wide text-slate-500 mb-1">qualitative comments</div>
            <ul className="list-disc list-inside text-xs text-slate-600 space-y-1">
              {(stats.feedbackComments || []).length ? (
                stats.feedbackComments.map((c, i) => <li key={i}>{c}</li>)
              ) : (
                <li className="text-slate-500">no comments yet</li>
              )}
            </ul>
          </div>
        </div>
      ) : (
        <div className="text-sm text-slate-500">refresh to load stats for the tag.</div>
      )}
    </Card>
  );
}
