// src/features/learning/curriculumReview.js
import { auth, app } from "../../firebase";
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  limit as qLimit,
} from "firebase/firestore";

const memoryMistakes = [];

export async function logCurriculumMistake({
  lessonId,
  questionId,
  prompt,
  correctAnswer,
  userAnswer,
  createdAt,
}) {
  const entry = {
    lessonId: lessonId || null,
    questionId: questionId || null,
    prompt: prompt || "",
    correctAnswer: correctAnswer || "",
    userAnswer: userAnswer || "",
    createdAt: createdAt || new Date().toISOString(),
  };

  const user = auth.currentUser;
  if (!user) {
    memoryMistakes.unshift(entry);
    return { ok: true, stored: "memory" };
  }

  try {
    const db = getFirestore(app);
    const col = collection(db, "curriculumMistakes", user.uid, "items");
    await addDoc(col, entry);
    return { ok: true, stored: "firestore" };
  } catch (e) {
    memoryMistakes.unshift(entry);
    return { ok: false, stored: "memory", error: e?.message || String(e) };
  }
}

export async function getCurriculumMistakes(limit = 20) {
  const user = auth.currentUser;
  if (!user) {
    return memoryMistakes.slice(0, limit);
  }
  try {
    const db = getFirestore(app);
    const col = collection(db, "curriculumMistakes", user.uid, "items");
    const snap = await getDocs(query(col, orderBy("createdAt", "desc"), qLimit(limit)));
    const rows = [];
    snap.forEach((doc) => rows.push(doc.data()));
    return rows;
  } catch (e) {
    return memoryMistakes.slice(0, limit);
  }
}
