// frontend/src/lib/api.js
import { auth } from "../firebase";

const BASE = "http://127.0.0.1:5050/api";
console.info("[api] BASE =", BASE);

// token
async function token() {
  const u = auth?.currentUser || null;
  if (!u) return null;
  return await u.getIdToken();
}

// local storage helpers
const ls = {
  get(name, fallback) {
    try { return JSON.parse(localStorage.getItem(name)) ?? fallback; } catch { return fallback; }
  },
  set(name, v) { try { localStorage.setItem(name, JSON.stringify(v)); } catch {} },
  del(name) { try { localStorage.removeItem(name); } catch {} },
};

/* ---------- health ---------- */
export async function apiHealth() {
  const r = await fetch(`${BASE}/health`, { cache: "no-store" });
  if (!r.ok) throw new Error(`health failed: ${r.status}`);
  return r.json();
}

/* ---------- learning summary ---------- */
export async function getSummary({ limit = 50 } = {}) {
  const t = await token();
  if (!t) throw new Error("NO_AUTH");
  const r = await fetch(`${BASE}/attempts/summary?limit=${limit}`, {
    headers: { Authorization: `Bearer ${t}` },
  });
  if (!r.ok) throw new Error(`getSummary failed: ${r.status}`);
  return r.json();
}

export async function getStudySummary({ tag, limit = 500 } = {}) {
  const t = await token();
  if (!t) throw new Error("NO_AUTH");
  const qs = new URLSearchParams({
    tag: String(tag || ""),
    limit: String(limit),
  });
  const r = await fetch(`${BASE}/study/summary?${qs.toString()}`, {
    headers: { Authorization: `Bearer ${t}` },
  });
  if (!r.ok) throw new Error(`getStudySummary failed: ${r.status}`);
  return r.json();
}

export async function saveAttempt(payload) {
  const t = await token();
  if (!t) throw new Error("NO_AUTH");
  const r = await fetch(`${BASE}/attempts`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` },
    body: JSON.stringify(payload),
  });
  if (!r.ok) throw new Error(`saveAttempt failed: ${r.status}`);
  return r.json();
}

export async function saveFeedback(payload) {
  const t = await token();
  if (!t) throw new Error("NO_AUTH");
  const r = await fetch(`${BASE}/feedback`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` },
    body: JSON.stringify(payload || {}),
  });
  if (!r.ok) throw new Error(`saveFeedback failed: ${r.status}`);
  return r.json();
}

/* ---------- ai lesson builder ---------- */
export async function generateLessonPlan(payload) {
  const t = await token();
  if (!t) throw new Error("NO_AUTH");
  const r = await fetch(`${BASE}/lessons/generate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${t}`,
    },
    body: JSON.stringify(payload || {}),
  });
  const data = await r.json().catch(() => null);
  if (!r.ok || data?.ok === false) {
    const err = data?.error || `generateLessonPlan failed: ${r.status}`;
    throw new Error(err);
  }
  return data;
}

/* ---------- pronunciation scoring ---------- */
// src/lib/api.js
export async function assessAudio({ blob, target, lang = "en", beam = 5, vad = 1, temperature = 0 }) {
  const clean = String(target || "").trim();
  if (!clean) throw new Error("target_required");
  const fd = new FormData();
  fd.append("file", blob, "audio.webm");
  const qs = new URLSearchParams({
    target: clean,
    lang,
    beam: String(beam),
    vad: String(vad),
    temperature: String(temperature),
  });
  const r = await fetch(`${BASE}/assess?${qs.toString()}`, { method: "POST", body: fd });
  if (!r.ok) {
    const txt = await r.text().catch(() => "");
    throw new Error(`assess_failed_${r.status}: ${txt}`);
  }
  return r.json();
}

export async function assessAudioStream({ blob, target, lang = "en", beam = 5, vad = 1, temperature = 0, onSegment, signal }) {
  const clean = String(target || "").trim();
  if (!clean) throw new Error("target_required");
  const fd = new FormData();
  fd.append("file", blob, "audio.webm");
  const qs = new URLSearchParams({
    target: clean,
    lang,
    beam: String(beam),
    vad: String(vad),
    temperature: String(temperature),
  });
  const r = await fetch(`${BASE}/assess/stream?${qs.toString()}`, { method: "POST", body: fd, signal });
  if (!r.ok || !r.body) {
    const txt = await r.text().catch(() => "");
    throw new Error(`assess_stream_failed_${r.status}: ${txt}`);
  }

  const reader = r.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";
  let final = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n\n");
    buffer = parts.pop(); // keep partial
    for (const chunk of parts) {
      const lines = chunk.split("\n");
      let event = "message";
      let data = "";
      for (const line of lines) {
        if (line.startsWith("event:")) event = line.slice(6).trim();
        else if (line.startsWith("data:")) data += line.slice(5).trim();
      }
      if (!data) continue;
      let parsed = null;
      try { parsed = JSON.parse(data); } catch { parsed = { raw: data }; }
      if (event === "segment" && typeof onSegment === "function") {
        onSegment(parsed);
      } else if (event === "done") {
        final = parsed;
      } else if (event === "error") {
        throw new Error(parsed?.error || "stream_error");
      }
    }
  }
  if (final) return final;
  throw new Error("stream_ended_without_result");
}

/* ---------- voice security minimal api ---------- */
export async function voiceExists() {
  const t = await token();
  if (!t) throw new Error("NO_AUTH");
  const r = await fetch(`${BASE}/voice/exists`, {
    headers: { Authorization: `Bearer ${t}` },
  });
  if (!r.ok) throw new Error(`voiceExists failed: ${r.status}`);
  const data = await r.json();
  return {
    enrolled: !!data?.enrolled,
    samples: Number(data?.samples || 0),
    ok: data?.ok !== false,
  };
}

export async function enrollVoice({ blob }) {
  const t = await token();
  if (!t) throw new Error("NO_AUTH");
  const fd = new FormData();
  fd.append("file", blob, "audio.webm");
  const r = await fetch(`${BASE}/voice/enroll`, {
    method: "POST",
    headers: { Authorization: `Bearer ${t}` },
    body: fd,
  });
  const data = await r.json().catch(() => null);
  if (!r.ok) {
    const msg = data?.error || `enroll_failed: ${r.status}`;
    throw new Error(msg);
  }
  const safeData = data || {};
  ls.set("voice_enrolled", true);
  return {
    enrolled: !!safeData.enrolled,
    samples: Number(safeData.samples || 0),
    ok: safeData.ok !== false,
  };
}

export async function verifyVoice({ blob }) {
  const t = await token();
  if (!t) throw new Error("NO_AUTH");
  const fd = new FormData();
  fd.append("file", blob, "audio.webm");
  const r = await fetch(`${BASE}/voice/verify`, {
    method: "POST",
    headers: { Authorization: `Bearer ${t}` },
    body: fd,
  });
  if (!r.ok) {
    const txt = await r.text().catch(() => "");
    throw new Error(`verify_failed: ${r.status} ${txt}`);
  }
  const data = await r.json(); // { ok, match, score }
  if (data?.ok && data?.match) {
    const until = Date.now() + 5 * 60 * 1000;
    ls.set("voice_pass_until", until);
  }
  return {
    match: data?.match === true,
    score: typeof data?.score === "number" ? data.score : 0,
    ok: data?.ok !== false,
    raw: data,
  };
}

export async function getEnrollSampleUrl() {
  const t = await token();
  if (!t) throw new Error("NO_AUTH");
  const r = await fetch(`${BASE}/voice/sample`, { headers: { Authorization: `Bearer ${t}` } });
  if (!r.ok) throw new Error(`sample_failed: ${r.status}`);
  const ct = r.headers.get("content-type") || "";
  if (ct.startsWith("audio/")) {
    const buf = await r.blob();
    return { url: URL.createObjectURL(buf) };
  }
  return r.json();
}

/* ---------- simple front end fallbacks ---------- */
export async function isVoiceVerifiedFresh() {
  const until = Number(ls.get("voice_pass_until", 0));
  return { ok: true, fresh: until && Date.now() < until, until };
}
export async function markVoiceVerifiedNow() {
  const until = Date.now() + 10 * 60 * 1000;
  ls.set("voice_pass_until", until);
  return { ok: true, until };
}
export async function clearVoicePass() {
  ls.del("voice_pass_until");
  return { ok: true };
}

export async function storeEnrollSample({ blob }) {
  try {
    const url = URL.createObjectURL(blob);
    ls.set("enroll_sample_url", url);
  } catch {}
  return { ok: true };
}
export async function getEnrollSampleUrlDevOnly() {
  const url = ls.get("enroll_sample_url", null);
  return { url };
}
export async function clearEnrollSample() {
  ls.del("enroll_sample_url");
  return { ok: true };
}

/* ---------- optional local logs ---------- */
const SEC_LOG_KEY = "security_log";
export async function logSecurityEvent(type, payload = {}) {
  const arr = ls.get(SEC_LOG_KEY, []);
  arr.unshift({ ts: new Date().toISOString(), type, payload });
  ls.set(SEC_LOG_KEY, arr.slice(0, 200));
  return { ok: true };
}
export async function readSecurityLog() {
  return { ok: true, items: ls.get(SEC_LOG_KEY, []) };
}
export async function clearSecurityLog() {
  ls.del(SEC_LOG_KEY);
  return { ok: true };
}

const LEARN_LOG_KEY = "learn_log";
export async function logLearnEvent(type, payload = {}) {
  const arr = ls.get(LEARN_LOG_KEY, []);
  arr.unshift({ ts: new Date().toISOString(), type, payload });
  ls.set(LEARN_LOG_KEY, arr.slice(0, 500));
  return { ok: true };
}
