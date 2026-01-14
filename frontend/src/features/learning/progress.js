// src/features/learning/progress.js
import { auth, app } from "../../firebase";
import { getFirestore, doc, getDoc, setDoc } from "firebase/firestore";
import { ALL_LESSONS, LESSON_ORDER } from "./curriculum";

const db = getFirestore(app);
const LS_PROGRESS = "learn_progress_fallback_v1";
const LS_DAILY = "daily_plan_fallback_v1";

export const DEFAULT_PROGRESS = {
  completedLessons: {},
  lastLessonId: null,
  xp: 0,
  streakDays: 0,
  lastStudyDate: null,
  weeklyQuest: {
    goal: 4,
    done: 0,
    resetDate: null,
  },
};

export function todayKey(d = new Date()) {
  return d.toISOString().slice(0, 10);
}

export function computeStreak(lastDate, today = todayKey()) {
  if (!lastDate) return 1;
  const last = new Date(lastDate);
  const t = new Date(today);
  const diffDays = Math.floor((t - last) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return null; // unchanged
  if (diffDays === 1) return "increment";
  return "reset";
}

function readLSProgress() {
  try {
    return JSON.parse(localStorage.getItem(LS_PROGRESS)) || { ...DEFAULT_PROGRESS };
  } catch {
    return { ...DEFAULT_PROGRESS };
  }
}

function writeLSProgress(p) {
  try {
    localStorage.setItem(LS_PROGRESS, JSON.stringify(p));
  } catch {}
}

function readLSDaily() {
  try {
    return JSON.parse(localStorage.getItem(LS_DAILY)) || null;
  } catch {
    return null;
  }
}

function writeLSDaily(p) {
  try {
    localStorage.setItem(LS_DAILY, JSON.stringify(p));
  } catch {}
}

export async function getProgress(user = auth.currentUser) {
  if (!user) {
    return readLSProgress();
  }
  const ref = doc(db, "progress", user.uid);
  try {
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      const base = { ...DEFAULT_PROGRESS };
      await setDoc(ref, base, { merge: true });
      return base;
    }
    return normalizeProgress({ ...DEFAULT_PROGRESS, ...(snap.data() || {}) });
  } catch (e) {
    console.warn("[progress] getProgress fallback to local", e?.message || e);
    return normalizeProgress(readLSProgress());
  }
}

export async function saveProgress(progress, user = auth.currentUser) {
  if (!user) {
    const norm = normalizeProgress(progress);
    writeLSProgress(norm);
    return norm;
  }
  const norm = normalizeProgress(progress);
  const ref = doc(db, "progress", user.uid);
  try {
    await setDoc(ref, norm, { merge: true });
  } catch (e) {
    console.warn("[progress] saveProgress failed, writing local", e?.message || e);
    writeLSProgress(norm);
  }
  return norm;
}

export function pickNextLesson(progress, order = LESSON_ORDER) {
  const completed = progress?.completedLessons || {};
  const lastId = progress?.lastLessonId;
  if (!lastId) {
    return order.find((id) => !completed[id]) || order[0];
  }
  const startIdx = Math.max(0, order.indexOf(lastId) + 1);
  for (let i = startIdx; i < order.length; i += 1) {
    const id = order[i];
    if (!completed[id]) return id;
  }
  return order[startIdx - 1] || order[order.length - 1];
}

export function pickDailyLesson(progress, summary, order = LESSON_ORDER, allLessons = ALL_LESSONS) {
  const completed = progress?.completedLessons || {};
  const hardestWords = summary?.hardestWords || [];
  const avgAcc = typeof summary?.avgAccuracy === "number" ? summary.avgAccuracy : null;
  const nextDefault = pickNextLesson(progress, order);
  const completedCount = Object.keys(completed).length;

  const levelOrder = Array.from(new Set(order.map((id) => allLessons[id]?.levelId).filter(Boolean)));
  const lastLesson = progress?.lastLessonId ? allLessons[progress.lastLessonId] : null;

  const focusTags = hardestWords.map((w) => String(w || "").toLowerCase());
  const tagMatch = order.find((id) => {
    if (completed[id]) return false;
    const lesson = allLessons[id];
    if (!lesson) return false;
    const tags = (lesson.tags || []).map((t) => String(t || "").toLowerCase());
    return tags.some((t) => focusTags.some((f) => t.includes(f) || f.includes(t)));
  });

  const todayIdx = Number(todayKey().replace(/-/g, "").slice(-2));
  const challengeDay = avgAcc != null && avgAcc > 0.85 && completedCount >= 5 && todayIdx % 3 === 0;
  let challengeLesson = null;
  if (challengeDay && lastLesson) {
    const currentLevelIdx = levelOrder.indexOf(lastLesson.levelId);
    const nextLevelId = levelOrder[currentLevelIdx + 1];
    if (nextLevelId) {
      challengeLesson = order.find((id) => !completed[id] && allLessons[id]?.levelId === nextLevelId) || null;
    }
  }

  const firstIncomplete = order.find((id) => !completed[id]) || order[0];

  return tagMatch || challengeLesson || nextDefault || firstIncomplete;
}

export async function saveLessonCompleted(lesson, user = auth.currentUser, opts = {}) {
  const uid = user?.uid;
  const progress = await getProgress(user);
  const today = todayKey();
  const streakState = computeStreak(progress.lastStudyDate, today);
  const nextStreak =
    streakState === "increment"
      ? (progress.streakDays || 0) + 1
      : streakState === "reset"
      ? 1
      : progress.streakDays || 1;

  const xpReward = Number(lesson?.xpReward || 10) + Number(opts.bonusXp || 0);
  const weekly = progress.weeklyQuest || {};
  const weekStart = weekly.resetDate || startOfWeek(today);
  const isNewWeek = weekStart < startOfWeek(today);
  const weeklyQuest = {
    goal: weekly.goal || 4,
    done: isNewWeek ? 0 : Math.min(weekly.goal || 4, weekly.done || 0),
    resetDate: isNewWeek ? startOfWeek(today) : weekStart,
  };
  weeklyQuest.done = Math.min(weeklyQuest.goal, weeklyQuest.done + 1);

  const updated = {
    ...progress,
    completedLessons: {
      ...(progress.completedLessons || {}),
      [lesson.id]: true,
    },
    lastLessonId: lesson.id,
    xp: (progress.xp || 0) + xpReward,
    streakDays: nextStreak,
    lastStudyDate: today,
    weeklyQuest,
  };

  await saveProgress(updated, user);

  // update daily plan completion if matches today
  if (uid) {
    const dailyRef = doc(db, "dailyPlan", uid);
    try {
      const snap = await getDoc(dailyRef);
      if (snap.exists()) {
        const data = snap.data() || {};
        if (data.date === today && data.lessonId === lesson.id && !data.completed) {
          await setDoc(dailyRef, { completed: true }, { merge: true });
        }
      }
    } catch (e) {
      console.warn("[progress] daily plan completion fallback to local", e?.message || e);
    }
  } else {
    const current = readLSDaily();
    if (current && current.date === today && current.lessonId === lesson.id && !current.completed) {
      writeLSDaily({ ...current, completed: true });
    }
  }

  return updated;
}

export async function getDailyPlan(user = auth.currentUser) {
  if (!user) {
    return readLSDaily();
  }
  const ref = doc(db, "dailyPlan", user.uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return snap.data();
}

export async function saveDailyPlan(plan, user = auth.currentUser) {
  if (!user) {
    writeLSDaily(plan);
    return plan;
  }
  const ref = doc(db, "dailyPlan", user.uid);
  await setDoc(ref, plan, { merge: true });
  return plan;
}

export async function ensureDailyPlan(progress, summary, user = auth.currentUser, allLessons = ALL_LESSONS) {
  const today = todayKey();
  let existing = null;
  try {
    existing = await getDailyPlan(user);
  } catch (e) {
    console.warn("[progress] getDailyPlan failed", e?.message || e);
  }
  const existingValid =
    existing &&
    existing.date === today &&
    existing.lessonId &&
    (allLessons?.[existing.lessonId] != null);
  if (existingValid) return existing;

  const lessonId = pickDailyLesson(progress, summary, LESSON_ORDER, allLessons);
  const focusWords = (summary?.hardestWords || []).slice(0, 2);
  const plan = {
    date: today,
    lessonId,
    focusWords,
    completed: false,
  };
  await saveDailyPlan(plan, user);
  return plan;
}

function normalizeProgress(p = DEFAULT_PROGRESS) {
  const weekly = p.weeklyQuest || {};
  const resetDate = weekly.resetDate || todayKey();
  const weekStart = startOfWeek(todayKey());
  const needsReset = !weekly.resetDate || weekly.resetDate < weekStart;
  const normalizedWeekly = needsReset
    ? { goal: weekly.goal || 4, done: 0, resetDate: weekStart }
    : { goal: weekly.goal || 4, done: weekly.done || 0, resetDate };
  return { ...p, weeklyQuest: normalizedWeekly };
}

function startOfWeek(dateStr) {
  const d = new Date(dateStr);
  const day = d.getUTCDay() || 7; // Monday = 1
  d.setUTCDate(d.getUTCDate() - (day - 1));
  return d.toISOString().slice(0, 10);
}
