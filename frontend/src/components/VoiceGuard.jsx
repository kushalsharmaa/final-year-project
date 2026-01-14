// frontend/src/components/VoiceGuard.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  voiceExists,
  enrollVoice,
  verifyVoice,
  assessAudio,
  isVoiceVerifiedFresh,
  clearVoicePass,
} from "../lib/api";

const CHALLENGE_PHRASES = [
  "The quick brown fox jumps over the lazy dog.",
  "Speaking clearly keeps the message strong.",
  "Please repeat this sentence to verify your voice.",
  "I promise to use my own voice in this app.",
  "Practice makes perfect pronunciation every day.",
];

const RECORD_MS = 4500;
const MIN_RMS = 0.015; // reject near-silent samples
const PASS_MINUTES = 5;

function pickChallenge() {
  return CHALLENGE_PHRASES[Math.floor(Math.random() * CHALLENGE_PHRASES.length)];
}

function formatExpiry(until) {
  if (!until) return "";
  const mins = Math.max(0, Math.round((until - Date.now()) / 60000));
  return mins === 0 ? "expires soon" : `expires in ${mins} min`;
}

function StatusPill({ tone = "slate", children }) {
  const colors = {
    slate: "bg-slate-100 text-slate-700",
    amber: "bg-amber-100 text-amber-800",
    emerald: "bg-emerald-100 text-emerald-800",
    rose: "bg-rose-100 text-rose-800",
    indigo: "bg-indigo-100 text-indigo-700",
  };
  return (
    <span className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ${colors[tone] || colors.slate}`}>
      {children}
    </span>
  );
}

export default function VoiceGuard({ children }) {
  const [checking, setChecking] = useState(true);
  const [enrolled, setEnrolled] = useState(false);
  const [samples, setSamples] = useState(0);
  const [verified, setVerified] = useState(false);
  const [verifiedUntil, setVerifiedUntil] = useState(null);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [challenge, setChallenge] = useState(() => pickChallenge());
  const [enrollBusy, setEnrollBusy] = useState(false);
  const [verifyBusy, setVerifyBusy] = useState(false);
  const [recording, setRecording] = useState(false);
  const [level, setLevel] = useState(0);

  const analyserRef = useRef(null);
  const audioCtxRef = useRef(null);
  const rafRef = useRef(0);
  const levelStatsRef = useRef({ sum: 0, count: 0 });

  useEffect(() => {
    checkStatus();
    return () => cleanupAudio();
  }, []);

  useEffect(() => {
    if (!verified) return;
    const id = setInterval(async () => {
      try {
        const fresh = await isVoiceVerifiedFresh().catch(() => null);
        if (!fresh?.fresh) {
          setVerified(false);
          setVerifiedUntil(null);
        }
      } catch {}
    }, 30000);
    return () => clearInterval(id);
  }, [verified]);

  const needsEnroll = useMemo(() => !enrolled, [enrolled]);
  const needsVerify = useMemo(() => enrolled && !verified, [enrolled, verified]);

  function cleanupAudio() {
    cancelAnimationFrame(rafRef.current);
    try { audioCtxRef.current?.close?.(); } catch {}
    audioCtxRef.current = null;
    analyserRef.current = null;
  }

  async function checkStatus() {
    setChecking(true);
    setError("");
    setInfo("");
    try {
      const fresh = await isVoiceVerifiedFresh().catch(() => null);
      if (fresh?.fresh) {
        setVerified(true);
        setVerifiedUntil(Number(fresh.until || Date.now() + PASS_MINUTES * 60000));
      } else {
        setVerified(false);
        setVerifiedUntil(null);
      }
      const exists = await voiceExists();
      setEnrolled(!!exists?.enrolled);
      setSamples(Number(exists?.samples || 0));
    } catch (e) {
      setError("Could not check voice status. Please try again.");
    } finally {
      setChecking(false);
    }
  }

  function startMeter(stream) {
    cleanupAudio();
    audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
    analyserRef.current = audioCtxRef.current.createAnalyser();
    analyserRef.current.fftSize = 1024;
    const source = audioCtxRef.current.createMediaStreamSource(stream);
    source.connect(analyserRef.current);
    levelStatsRef.current = { sum: 0, count: 0 };

    const pump = () => {
      if (!analyserRef.current) return;
      const buf = new Uint8Array(analyserRef.current.fftSize);
      analyserRef.current.getByteTimeDomainData(buf);
      let sum = 0;
      for (let i = 0; i < buf.length; i++) {
        const v = (buf[i] - 128) / 128;
        sum += v * v;
      }
      const rms = Math.sqrt(sum / buf.length);
      levelStatsRef.current.sum += rms;
      levelStatsRef.current.count += 1;
      setLevel(Math.min(1, Math.max(0, rms * 3)));
      rafRef.current = requestAnimationFrame(pump);
    };
    pump();
  }

  async function captureSample() {
    setError("");
    setInfo("");
    setRecording(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      startMeter(stream);
      const mr = new MediaRecorder(stream, { mimeType: "audio/webm" });
      const parts = [];

      return await new Promise((resolve, reject) => {
        mr.ondataavailable = (e) => { if (e.data && e.data.size) parts.push(e.data); };
        mr.onerror = (e) => reject(e.error || new Error("record_failed"));
        mr.onstop = () => {
          stream.getTracks().forEach((t) => t.stop());
          cleanupAudio();
          setRecording(false);
          const avgRms = levelStatsRef.current.count
            ? levelStatsRef.current.sum / levelStatsRef.current.count
            : 0;
          if (avgRms < MIN_RMS) {
            reject(new Error("Audio too quiet. Please move closer to the mic."));
            return;
          }
          resolve(new Blob(parts, { type: "audio/webm" }));
        };
        mr.start();
        setTimeout(() => { try { mr.stop(); } catch {} }, RECORD_MS);
      });
    } catch (e) {
      cleanupAudio();
      setRecording(false);
      throw e;
    }
  }

  async function handleEnroll() {
    setEnrollBusy(true);
    try {
      const blob = await captureSample();
      const res = await enrollVoice({ blob });
      setEnrolled(!!res.enrolled);
      setSamples(Number(res.samples || samples + 1));
      setInfo(`Saved sample #${Number(res.samples || samples + 1)}. Record at least 2 samples.`);
    } catch (e) {
      setError(e?.message || "Enrollment failed. Please try again.");
    } finally {
      setEnrollBusy(false);
    }
  }

  async function checkChallengePhrase(blob) {
    const target = String(challenge || "").trim();
    if (!target) return true;
    const res = await assessAudio({
      blob,
      target,
      lang: "en",
      beam: 5,
      vad: 1,
      temperature: 0,
    });
    const transcript = String(res?.transcript || "").toLowerCase();
    const targetNorm = target.toLowerCase();
    const contains = transcript.includes(targetNorm.slice(0, Math.min(20, targetNorm.length)));
    if (!contains || (typeof res.accuracy === "number" && res.accuracy < 0.5)) {
      throw new Error("Challenge phrase not detected. Speak the displayed phrase clearly.");
    }
    return true;
  }

  async function handleVerify() {
    setVerifyBusy(true);
    setError("");
    setInfo("");
    try {
      const blob = await captureSample();

      // 1) verify the spoken phrase to deter replays
      try {
        await checkChallengePhrase(blob);
      } catch (e) {
        setError(e?.message || "Challenge phrase failed.");
        return;
      }

      // 2) verify voice embedding against enrollment
      const res = await verifyVoice({ blob });
      if (res.match) {
        const until = Date.now() + PASS_MINUTES * 60 * 1000;
        setVerified(true);
        setVerifiedUntil(until);
        setInfo("Voice verified. Lab unlocked.");
      } else {
        setError("Voice did not match your enrolled samples. Try again in a quiet room.");
      }
    } catch (e) {
      setError(e?.message || "Verification failed. Please try again.");
    } finally {
      setVerifyBusy(false);
      setChallenge(pickChallenge());
    }
  }

  async function handleReset() {
    await clearVoicePass().catch(() => {});
    setVerified(false);
    setVerifiedUntil(null);
    setChallenge(pickChallenge());
  }

  if (checking) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">Checking voice security…</div>
      </div>
    );
  }

  if (!verified) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-2">
          <div className="flex items-center gap-3">
            <StatusPill tone="indigo">Voice security required</StatusPill>
            {enrolled ? <StatusPill tone="emerald">Enrolled</StatusPill> : <StatusPill tone="amber">Not enrolled</StatusPill>}
          </div>
          <p className="text-slate-700 text-sm">
            Record your voice to enroll, then read the challenge phrase to unlock the pronunciation lab for this session.
          </p>
          <ul className="list-disc list-inside text-sm text-slate-600 space-y-1">
            <li>Use a quiet space and speak clearly.</li>
            <li>Record at least two enrollment samples.</li>
            <li>Challenge phrases prevent replay attacks.</li>
          </ul>
          {error && <div className="rounded-lg bg-rose-50 text-rose-800 px-3 py-2 text-sm">{error}</div>}
          {info && <div className="rounded-lg bg-emerald-50 text-emerald-800 px-3 py-2 text-sm">{info}</div>}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-slate-900">Step 1 — Enroll your voice</h3>
              <StatusPill tone={enrolled ? "emerald" : "amber"}>
                {samples} / 2 samples
              </StatusPill>
            </div>
            <p className="text-sm text-slate-600">
              Record a short 3–4 second clip in your normal speaking voice. Aim for two samples to build a stable profile.
            </p>
            <button
              className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm hover:border-slate-400 disabled:opacity-50"
              onClick={handleEnroll}
              disabled={enrollBusy || recording}
            >
              {enrollBusy || recording ? "Recording…" : "Record enrollment clip"}
            </button>
            <div className="text-xs text-slate-500">Mic level: {Math.round(level * 100)}%</div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-slate-900">Step 2 — Verify with challenge</h3>
              <StatusPill tone={needsVerify ? "amber" : "emerald"}>
                {needsVerify ? "Not verified" : "Ready"}
              </StatusPill>
            </div>
            <p className="text-sm text-slate-600">Read this phrase out loud during verification:</p>
            <div className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-semibold text-indigo-800">
              “{challenge}”
            </div>
            <button
              className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
              onClick={handleVerify}
              disabled={verifyBusy || recording || needsEnroll}
            >
              {verifyBusy || recording ? "Verifying…" : "Start verification"}
            </button>
            <div className="text-xs text-slate-500">Mic level: {Math.round(level * 100)}%</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <div className="border-b border-emerald-200 bg-emerald-50">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-3 text-sm text-emerald-900">
          <StatusPill tone="emerald">Voice verified</StatusPill>
          <span>Lab unlocked — {formatExpiry(verifiedUntil)}.</span>
          <button
            className="ml-auto inline-flex items-center rounded-lg border border-emerald-300 px-3 py-1 text-xs font-semibold text-emerald-900 hover:bg-emerald-100"
            onClick={handleReset}
          >
            Re-verify
          </button>
        </div>
      </div>
      {children}
    </div>
  );
}
