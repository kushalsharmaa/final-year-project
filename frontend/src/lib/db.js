// frontend/src/lib/db.js
// Dual storage for phrases, attempts, streaks & hard words (guest fallback).
import { app, auth } from "../firebase";
import {
  getFirestore, collection, addDoc, doc, deleteDoc,
  query, where, orderBy, getDocs, serverTimestamp
} from "firebase/firestore";

let db = null;
try { db = getFirestore(app); } catch { db = null; }

// ---- localStorage keys
const LS_PHRASES   = "guest_phrases_v1";
const LS_ATTEMPTS  = "guest_attempts_v2"; // includes hardWords, createdAt
const LS_HARDWORDS = "guest_hard_words_v1";

// ---- helpers
function readJSON(key, fallback) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
  catch { return fallback; }
}
function writeJSON(key, v) { try { localStorage.setItem(key, JSON.stringify(v)); } catch {} }
function genId() { return Math.random().toString(36).slice(2) + Date.now().toString(36); }
function currentUser() { try { return auth?.currentUser || null; } catch { return null; } }

// ================= Phrases =================
export async function getUserPhrases() {
  const u = currentUser();
  if (u && db) {
    try {
      const q = query(
        collection(db, "user_phrases"),
        where("uid", "==", u.uid),
        orderBy("createdAt", "desc"),
      );
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (e) {
      console.warn("[db] getUserPhrases cloud failed; using guest:", e?.message || e);
    }
  }
  return readJSON(LS_PHRASES, []);
}

export async function addUserPhrase({ text, lang = "en" }) {
  const clean = (text || "").trim().replace(/\s+/g, " ");
  if (!clean) throw new Error("Empty phrase.");
  const u = currentUser();
  if (u && db) {
    try {
      await addDoc(collection(db, "user_phrases"), {
        uid: u.uid, text: clean, lang, createdAt: serverTimestamp(),
      });
      return { saved: "cloud" };
    } catch (e) {
      console.warn("[db] addUserPhrase cloud failed; falling back:", e?.message || e);
    }
  }
  const arr = readJSON(LS_PHRASES, []);
  arr.unshift({ id: genId(), uid: "guest", text: clean, lang, createdAt: Date.now() });
  writeJSON(LS_PHRASES, arr.slice(0, 100));
  return { saved: "local" };
}

export async function deleteUserPhrase(id) {
  const u = currentUser();
  if (u && db) {
    try {
      await deleteDoc(doc(db, "user_phrases", id));
      return { deleted: "cloud" };
    } catch (e) {
      console.warn("[db] deleteUserPhrase cloud failed; falling back:", e?.message || e);
    }
  }
  const arr = readJSON(LS_PHRASES, []).filter(p => p.id !== id);
  writeJSON(LS_PHRASES, arr);
  return { deleted: "local" };
}

// ================= Attempts (guest) =================
// Used when saveAttempt throws NO_AUTH.
export function addGuestAttempt(attempt) {
  const arr = readJSON(LS_ATTEMPTS, []);
  const row = {
    id: genId(),
    createdAt: Date.now(),
    target: attempt.target,
    lang: attempt.lang,
    accuracy: attempt.accuracy ?? 0,
    wer: attempt.wer ?? 0,
    duration: attempt.duration ?? null,
    latencyMs: attempt.latencyMs ?? null,
    serverLatencyMs: attempt.serverLatencyMs ?? null,
    transcribeMs: attempt.transcribeMs ?? null,
    scoreMs: attempt.scoreMs ?? null,
    transcribeAttempts: attempt.transcribeAttempts ?? null,
    avgConfidence: attempt.avgConfidence ?? null,
    accent: attempt.accent ?? null,
    accentConfidence: attempt.accentConfidence ?? null,
    studyTag: attempt.studyTag ?? null,
    sessionId: attempt.sessionId ?? null,
    hardWords: attempt.hardWords || [],
  };
  arr.unshift(row);
  writeJSON(LS_ATTEMPTS, arr.slice(0, 500));
  addGuestHardWords(row.hardWords);
}

export function getGuestAttempts(limit = 50) {
  return readJSON(LS_ATTEMPTS, []).slice(0, limit);
}

// ================= Hard words (guest) =================
export function addGuestHardWords(words = []) {
  const m = readJSON(LS_HARDWORDS, {});
  for (const w of words) {
    if (!w) continue;
    const k = String(w).toLowerCase();
    m[k] = (m[k] || 0) + 1;
  }
  writeJSON(LS_HARDWORDS, m);
}
export function getGuestHardWords(limit = 10) {
  const m = readJSON(LS_HARDWORDS, {});
  return Object.entries(m).sort((a,b)=>b[1]-a[1]).slice(0, limit).map(([w]) => w);
}
export function clearGuestHardWords() { writeJSON(LS_HARDWORDS, {}); }

// ================= Summary (guest) =================
export function getGuestSummary(limit = 50) {
  const rows = getGuestAttempts(limit);
  if (!rows.length) {
    return {
      count: 0,
      avgAccuracy: null,
      hardestWords: [],
      suggestedPhrases: [],
      items: [],
      streakDays: 0,
      lastPractice: null,
      recent: [],
    };
  }
  const avg = rows.reduce((s, r) => s + (r.accuracy || 0), 0) / rows.length;

  const freq = {};
  rows.forEach(r => (r.hardWords || []).forEach(w => {
    const k = String(w).toLowerCase();
    freq[k] = (freq[k] || 0) + 1;
  }));
  const hardest = Object.entries(freq).sort((a,b)=>b[1]-a[1]).map(([w])=>w);

  // streak (consecutive calendar days incl. today if any)
  const days = new Set(rows.map(r => new Date(r.createdAt).toISOString().slice(0,10)));
  let streak = 0;
  let d = new Date();
  while (true) {
    const key = d.toISOString().slice(0,10);
    if (days.has(key)) { streak += 1; d.setDate(d.getDate()-1); } else { break; }
  }

  const recent = rows.slice(0, 12).map(r => Math.round((r.accuracy || 0) * 100));

  return {
    count: rows.length,
    avgAccuracy: Number(avg.toFixed(4)),
    hardestWords: hardest.slice(0, 12),
    suggestedPhrases: hardest.slice(0, 6),
    items: rows,
    streakDays: streak,
    lastPractice: rows[0]?.createdAt || null,
    recent,
  };
}
