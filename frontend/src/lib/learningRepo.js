// src/lib/learningRepo.js
import { getAuth } from "firebase/auth";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  collection,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";

const db = getFirestore();
const auth = getAuth();

// sensible defaults if user profile doc doesn’t exist yet
const DEFAULT_PROFILE = {
  currentLevel: "A2",
  dailyGoalMinutes: 10,
  focusAreas: ["vocab", "pronunciation"],
  interests: [],
  skillGaps: {}, // e.g., { grammar_tense: 0.3 }
  createdAt: null,
  updatedAt: null,
};

/**
 * getProfile()
 * reads users/{uid} and returns a merged object with defaults.
 * if no doc exists, it returns DEFAULT_PROFILE (without creating anything).
 */
export async function getProfile() {
  const u = auth.currentUser;
  if (!u) return { ...DEFAULT_PROFILE };
  const ref = doc(db, "users", u.uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    // do not create automatically; caller may decide to save later
    return { ...DEFAULT_PROFILE };
  }
  const data = snap.data() || {};
  return {
    ...DEFAULT_PROFILE,
    ...data,
  };
}

/**
 * setProfile(partial)
 * upserts to users/{uid} and merges timestamps.
 */
export async function setProfile(partial = {}) {
  const u = auth.currentUser;
  if (!u) throw new Error("NO_AUTH");
  const ref = doc(db, "users", u.uid);
  const now = new Date().toISOString();
  await setDoc(
    ref,
    {
      ...partial,
      updatedAt: now,
      createdAt: partial?.createdAt || now,
    },
    { merge: true }
  );
  return { ok: true };
}

/**
 * saveLessonCompletion(entry)
 * writes to users/{uid}/lessonCompletions with server timestamp.
 */
export async function saveLessonCompletion(entry) {
  const u = auth.currentUser;
  if (!u) throw new Error("NO_AUTH");
  const payload = {
    ...entry,
    uid: u.uid,
    createdAt: serverTimestamp(),
  };
  const parent = doc(db, "users", u.uid);
  await addDoc(collection(parent, "lessonCompletions"), payload);
  return { ok: true };
}

/**
 * getUserProgress()
 * reads progress/{uid} and returns the user's progress in the curriculum.
 */
export async function getUserProgress() {
  const u = auth.currentUser;
  if (!u) return { completedLessons: {}, lastLessonId: null };
  const ref = doc(db, "progress", u.uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    return { completedLessons: {}, lastLessonId: null };
  }
  return snap.data();
}

/**
 * saveUserProgress(progress)
 * upserts to progress/{uid} and saves the user's curriculum progress.
 */
export async function saveUserProgress(progress) {
  const u = auth.currentUser;
  if (!u) throw new Error("NO_AUTH");
  const ref = doc(db, "progress", u.uid);
  await setDoc(ref, progress, { merge: true });
  return { ok: true };
}
