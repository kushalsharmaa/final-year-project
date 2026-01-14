// src/components/PronunciationSmokeTest.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom"; // <-- added useLocation
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "../firebase";

import {
  assessAudio, saveAttempt, getSummary, apiHealth, saveFeedback, getStudySummary,
  voiceExists, enrollVoice, verifyVoice, getEnrollSampleUrl,
} from "../lib/api";

import {
  getUserPhrases, addUserPhrase, deleteUserPhrase,
  addGuestAttempt, getGuestSummary, getGuestHardWords
} from "../lib/db";

/* top menu */
function TopNav() {
  const navigate = useNavigate();
  const user = auth.currentUser;
  return (
    <header className="sticky top-0 z-30 bg-white/90 backdrop-blur border-b border-gray-200">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-3">
        <Link to="/home" className="font-semibold text-gray-900">ai language app</Link>
        <nav className="ml-6 flex items-center gap-4 text-sm text-gray-700">
          <Link to="/home" className="hover:text-indigo-600">home</Link>
          <Link to="/lessons" className="hover:text-indigo-600">lessons</Link>
          <Link to="/learn" className="hover:text-indigo-600">learn</Link>
          <span className="text-gray-400">•</span>
          <span className="font-medium text-indigo-700">pronunciation lab</span>
        </nav>
        <div className="ml-auto flex items-center gap-2">
          {user && (
            <div className="hidden sm:flex items-center gap-2 text-sm text-gray-600">
              <div className="h-7 w-7 rounded-full bg-indigo-100 grid place-items-center text-indigo-700">
                {user.displayName?.charAt(0)?.toUpperCase() || user.email?.charAt(0)?.toUpperCase() || "U"}
              </div>
              <span className="max-w-[160px] truncate">{user.displayName || user.email}</span>
            </div>
          )}
          {user ? (
            <button
              className="px-3 py-1.5 text-sm rounded border bg-white hover:bg-gray-50"
              onClick={async () => { try { await signOut(auth); navigate("/login"); } catch {} }}
            >
              logout
            </button>
          ) : (
            <>
              <Link to="/login" className="px-3 py-1.5 text-sm rounded border bg-white hover:bg-gray-50">login</Link>
              <Link to="/register" className="px-3 py-1.5 text-sm rounded bg-indigo-600 text-white">register</Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

/* presets */
const PHRASES = {
  simple: ["Hello", "Good morning", "How are you?", "I am fine", "Thank you", "Good night"],
  medium: [
    "The cat is under the table",
    "Can I have a glass of water?",
    "It is a sunny day outside",
    "Where is the nearest supermarket?",
    "I like to watch movies at night",
  ],
  hard: [
    "The quick brown fox jumps over the lazy dog",
    "Although it was raining, we still went hiking",
    "She sells seashells by the seashore",
    "Pronunciation improves with regular practice",
    "The museum was filled with ancient artifacts and historical documents",
  ],
  study: [
    "The quick brown fox jumps over the lazy dog",
    "She sells seashells by the seashore",
    "Please turn off the lights before you leave",
    "I would like a glass of water",
    "The weather is warm and sunny today",
    "Can you explain the main idea again",
    "The train arrives at the station at seven",
    "I think this is the right answer",
    "We practiced pronunciation every day",
    "My favorite hobby is reading science fiction",
  ],
};

/* ui helpers */
function playTarget(text, langCode = "en US", voicesList = [], audioEl = null) {
  try {
    const synth = window.speechSynthesis;
    if (!synth) return;
    try { audioEl?.pause?.(); } catch {}
    try { synth.cancel(); } catch {}

    const preferred = [
      "Google US English", "Google UK English Male", "Google UK English Female",
      "Samantha", "Ava", "Alex", "Victoria",
      "Microsoft Aria Online (Natural) - English (United States)",
      "Microsoft Guy Online (Natural) - English (United States)"
    ];
    const byName = voicesList.find(v => preferred.includes(v.name) && v.lang?.startsWith("en"));
    const byLangLocal = voicesList.find(v => v.lang?.toLowerCase().startsWith(langCode.toLowerCase()) && v.localService);
    const byLangAny = voicesList.find(v => v.lang?.toLowerCase().startsWith(langCode.toLowerCase()));
    const voice = byName || byLangLocal || byLangAny || null;

    const u = new SpeechSynthesisUtterance(String(text || "").trim());
    const isShort = (u.text.split(/\s+/).join("").length <= 5);
    u.rate = isShort ? 0.85 : 0.95;
    u.pitch = 1.0;
    u.volume = 0.95;
    u.lang = langCode;
    if (voice) u.voice = voice;
    try { synth.resume?.(); } catch {}
    setTimeout(() => { try { synth.speak(u); } catch {} }, 0);
  } catch {}
}

function confToBg(conf) {
  const c = typeof conf === "number" ? conf : 1;
  if (c >= 0.8) return "bg-green-100 text-green-800";
  if (c >= 0.6) return "bg-emerald-100 text-emerald-800";
  if (c >= 0.4) return "bg-amber-100 text-amber-800";
  return "bg-rose-100 text-rose-800";
}

function makeSessionId() {
  return `sess_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function Chip({ w, onClick }) {
  let cls = confToBg(w.conf);
  if (w.status === "substitution") cls = "bg-amber-100 text-amber-800";
  if (w.status === "insertion") cls = "bg-sky-100 text-sky-800";
  if (w.status === "deletion") cls = "bg-rose-100 text-rose-800 line-through";
  const statusLabel = ["substitution", "deletion", "insertion"].includes(w.status) ? w.status : "";
  const tooltipLines = [
    w.expected ? `expected: ${w.expected}` : null,
    w.text ? `heard: ${w.text}` : null,
    statusLabel ? `status: ${statusLabel}` : null,
  ].filter(Boolean);
  const title = tooltipLines.join(" • ");
  return (
    <span className="relative group inline-block">
      <button
        type="button"
        className={`px-2 py-1 rounded text-sm mr-1.5 mb-1.5 ${cls}`}
        title={title}
        aria-label={title || w.text}
        onClick={onClick}
        disabled={w.start == null || w.end == null}
      >
        {w.text}
      </button>
      {tooltipLines.length > 0 && (
        <div className="absolute left-0 top-full mt-1 z-20 hidden group-hover:block group-focus-within:block">
          <div className="rounded-lg bg-white shadow-lg ring-1 ring-slate-200 px-3 py-2 text-xs text-slate-700 whitespace-nowrap">
            {tooltipLines.map((line, idx) => (
              <div key={idx}>{line}</div>
            ))}
          </div>
        </div>
      )}
    </span>
  );
}

function SectionCard({ title, right, children }) {
  return (
    <section className="relative isolate z-0 bg-white rounded-2xl shadow-sm ring-1 ring-gray-200 p-5 focus-within:z-20">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-gray-900">{title}</h3>
        {right}
      </div>
      {children}
    </section>
  );
}

function extractHardWords(res) {
  if (!res?.words) return [];
  const raw = res.words
    .filter(w => w?.status === "substitution" || w?.status === "deletion")
    .map(w => (w.expected || w.text || "").toLowerCase().trim())
    .filter(Boolean);
  const seen = new Set();
  return raw.filter(w => (seen.has(w) ? false : (seen.add(w), true)));
}

function ProgressBars({ values = [] }) {
  const max = Math.max(1, ...values);
  return (
    <div className="flex items-end gap-1 h-12">
      {values.map((v, i) => (
        <div key={i} className="w-2 bg-indigo-300 rounded" style={{ height: `${(v / max) * 100}%` }} title={`${v}%`} />
      ))}
    </div>
  );
}

function isProtectedUser(user) {
  return !!user && !user.isAnonymous;
}

function accentTipsFor(label) {
  const key = (label || "").toLowerCase();
  const map = [
    ["en-in", ["Watch w/v swaps and stretch long vowels (beat vs bit).", "Keep final consonants clear; avoid dropping endings.", "Slow slightly to let stressed syllables land."]],
    ["en-gb", ["Mind r-dropping; keep clear schwa in unstressed syllables.", "Stress content words; soften intrusive r between vowels.", "Hold long vowels in bath/path words."]],
    ["en-us", ["Keep consistent r-coloring; avoid rushing unstressed endings.", "Lift sentence stress on key nouns/verbs.", "Check th sounds; avoid turning them into d/t or f."]],
    ["en-au", ["Keep rising tone for yes/no, falling for statements.", "Keep vowel length contrast strong (ship vs sheep).", "Stress content words; lighten fillers."]],
    ["en-ph", ["Work on f/p and v/b contrasts; keep s/z sharp.", "Stretch vowel length on long vowels; avoid clipping endings.", "Watch th sounds; avoid turning into t/d."]],
  ];
  const match = map.find(([prefix]) => key.startsWith(prefix));
  if (match) return match[1];
  if (!key) return [];
  return ["Accent detected. Focus on steady pace, clear endings, and stressing content words."];
}

/* main page */
export default function PronunciationSmokeTest() {
  const location = useLocation(); // <-- new
  const navigate = useNavigate();

  const [difficulty, setDifficulty] = useState("simple");
  const [target, setTarget] = useState(PHRASES.simple[0]);
  const [lang, setLang] = useState("en");
  const [beam, setBeam] = useState(5);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [debugMode, setDebugMode] = useState(false);

  const [recording, setRecording] = useState(false);
  const [status, setStatus] = useState("ready");
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [livePreviewEnabled, setLivePreviewEnabled] = useState(false);
  const [livePreviewText, setLivePreviewText] = useState("");
  const [livePreviewError, setLivePreviewError] = useState("");
  const [previewSupported, setPreviewSupported] = useState(true);
  const livePreviewRef = useRef(null);

  function startLivePreview() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      setLivePreviewError("Live preview not supported in this browser.");
      return;
    }
    try {
      const rec = new SR();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = lang === "multi" ? "en-US" : lang;
      rec.onresult = (evt) => {
        let txt = "";
        for (let i = evt.resultIndex; i < evt.results.length; i++) {
          txt += evt.results[i][0].transcript;
        }
        setLivePreviewText(txt.trim());
      };
      rec.onerror = (e) => {
        setLivePreviewError(e?.error || "preview error");
      };
      rec.start();
      livePreviewRef.current = rec;
    } catch (e) {
      setLivePreviewError(e?.message || "preview failed");
    }
  }

  function stopLivePreview() {
    try { livePreviewRef.current?.stop?.(); } catch {}
    livePreviewRef.current = null;
    setLivePreviewText("");
  }

  const [summary, setSummary] = useState(null);
  const [coachError, setCoachError] = useState("");

  const [mics, setMics] = useState([]);
  const [deviceId, setDeviceId] = useState("");

  const chunksRef = useRef([]);
  const recRef = useRef(null);
  const audioUrlRef = useRef("");
  const visiblePlayerRef = useRef(null);
  const analyserCleanupRef = useRef(() => {});
  const stopTimeoutRef = useRef(0);
  const [level, setLevel] = useState(0);

  const [voices, setVoices] = useState([]);

  const [customText, setCustomText] = useState("");
  const [savedPhrases, setSavedPhrases] = useState([]);
  const [phraseMsg, setPhraseMsg] = useState("");
  const [loadingList, setLoadingList] = useState(true);

  const [fbUsability, setFbUsability] = useState(4);
  const [fbFeedback, setFbFeedback] = useState(4);
  const [fbSpeed, setFbSpeed] = useState(4);
  const [fbSatisfaction, setFbSatisfaction] = useState(4);
  const [fbPersonalization, setFbPersonalization] = useState(4);
  const [fbClarity, setFbClarity] = useState(4);
  const [fbIssues, setFbIssues] = useState({
    slow_response: false,
    wrong_word_flagged: false,
    unclear_tip: false,
    ui_confusing: false,
    noise_issue: false,
    mic_issue: false,
  });
  const [fbExampleMistake, setFbExampleMistake] = useState("");
  const [fbComment, setFbComment] = useState("");
  const [fbStatus, setFbStatus] = useState("");
  const [fbSubmitting, setFbSubmitting] = useState(false);
  const [studyTag, setStudyTag] = useState("chapter6");
  const [sessionId, setSessionId] = useState(() => makeSessionId());
  const [studyStats, setStudyStats] = useState(null);
  const [studyStatsLoading, setStudyStatsLoading] = useState(false);
  const [studyStatsError, setStudyStatsError] = useState("");

  const [user, setUser] = useState(() => auth.currentUser);
  const [enrolled, setEnrolled] = useState(false);
  const [samples, setSamples] = useState(0);
  const [showEnrollModal, setShowEnrollModal] = useState(false);
  const [enrollmentMode, setEnrollmentMode] = useState(false);
  const [enrollCount, setEnrollCount] = useState(0);
  const [securityStrikes, setSecurityStrikes] = useState(0);

  /* computed once here to avoid duplicate declaration */
  const cleanTarget = useMemo(() => String(target || "").trim(), [target]);
  const langLabel = useMemo(() => (lang === "en" ? "english" : "multilingual"), [lang]);

  /* set target when difficulty changes for preset mode */
  useEffect(() => {
    setTarget(PHRASES[difficulty][0]);
  }, [difficulty]);

  /* read target from query string when coming from lesson page */
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const fromLesson = params.get("target");
    if (fromLesson) {
      const text = fromLesson.trim();
      if (text) {
        setTarget(text);        // fill main target box
        setCustomText(text);    // also put it into custom field
      }
    }
  }, [location.search]);

  /* ping server */
  useEffect(() => { apiHealth().catch(()=>{}); }, []);

  /* load voices */
  useEffect(() => {
    const synth = window.speechSynthesis;
    if (!synth) return;
    let v = synth.getVoices();
    if (v && v.length) setVoices(v);
    const onVoices = () => setVoices(synth.getVoices());
    synth.addEventListener?.("voiceschanged", onVoices);
    const id = setInterval(() => {
      v = synth.getVoices();
      if (v && v.length) { setVoices(v); clearInterval(id); }
    }, 200);
    const killer = setTimeout(() => clearInterval(id), 3000);
    return () => { synth.removeEventListener?.("voiceschanged", onVoices); clearInterval(id); clearTimeout(killer); };
  }, []);

  /* load mic devices and request permission once */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try { await navigator.mediaDevices.getUserMedia({ audio: true }); } catch {}
      try {
        const devs = await navigator.mediaDevices.enumerateDevices();
        if (cancelled) return;
        const inputs = devs.filter((d) => d.kind === "audioinput");
        setMics(inputs);
        if (!deviceId && inputs[0]?.deviceId) setDeviceId(inputs[0].deviceId);
      } catch {}
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* load summary and phrases */
  async function refreshSummary(limit = 50) {
    try {
      const s = await getSummary({ limit });
      const normalized = {
        count: s.count,
        avgAccuracy: s.avg_accuracy ?? s.avgAccuracy ?? null,
        hardestWords: s.hardest_words ?? s.hardestWords ?? [],
        suggestedPhrases: s.suggested_phrases ?? s.suggestedPhrases ?? [],
        recent: s.recent ?? [],
        streakDays: s.streakDays ?? 0,
        advice: s.advice ?? "",
      };
      setSummary(normalized);
      setCoachError("");
    } catch (e) {
      const gs = getGuestSummary(limit);
      setSummary({
        count: gs.count,
        avgAccuracy: gs.avgAccuracy,
        hardestWords: gs.hardestWords,
        suggestedPhrases: gs.suggestedPhrases,
        recent: gs.recent,
        streakDays: gs.streakDays,
        advice:
          gs.count < 5 ? "do a few more short attempts to build your baseline."
          : gs.avgAccuracy < 0.7 ? "focus on short phrases. slow down and exaggerate stress."
          : "nice. increase difficulty or length.",
      });
      if (e?.code === "NO_AUTH") setCoachError("guest mode. sign in to sync your progress.");
    }
  }

  async function refreshPhrases() {
    try { setSavedPhrases(await getUserPhrases()); }
    finally { setLoadingList(false); }
  }

  useEffect(() => {
    refreshSummary(50);
    refreshPhrases();
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setSecurityStrikes(0);
      refreshSummary(50);
      refreshPhrases();
    });
    return () => unsub?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* voice security status */
  useEffect(() => {
    let on = true;
    (async () => {
      if (!user) {
        setEnrolled(false);
        setSamples(0);
        setShowEnrollModal(false);
        setEnrollmentMode(false);
        setEnrollCount(0);
        return;
      }
      try {
        const r = await voiceExists();
        if (!on) return;
        const hasProfile = !!r?.enrolled;
        setEnrolled(hasProfile);
        setSamples(Number(r?.samples || 0));
        if (!hasProfile) {
          setShowEnrollModal(true);
          setEnrollCount(0);
        } else {
          setShowEnrollModal(false);
          setEnrollmentMode(false);
        }
      } catch {
        // keep lab usable even if check fails
      }
    })();
    return () => { on = false; };
  }, [user]);

  /* detect live preview support */
  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    setPreviewSupported(!!SR);
    if (!SR) setLivePreviewEnabled(false);
  }, []);

  function pickPreferredMime() {
    const c = [
      "audio/webm;codecs=opus",
      "audio/webm",
      "audio/ogg;codecs=opus",
    ];
    return c.find((t) => window.MediaRecorder?.isTypeSupported?.(t));
  }

  function startSilenceDetector(stream) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    const ctx = new AudioCtx();
    const src = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 2048;
    src.connect(analyser);
    const data = new Uint8Array(analyser.fftSize);

    let silenceMs = 0;
    const interval = 60;
    const levelStop = 0.02;
    const neededMs = 1500;

    const id = setInterval(() => {
      analyser.getByteTimeDomainData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i++) {
        const v = (data[i] - 128) / 128;
        sum += v * v;
      }
      const rms = Math.sqrt(sum / data.length);
      setLevel(Math.min(1, rms * 6));

      if (rms < levelStop) {
        silenceMs += interval;
        if (silenceMs >= neededMs && recRef.current?.state === "recording") {
          try { recRef.current.stop(); } catch {}
        }
      } else {
        silenceMs = 0;
      }
    }, interval);

    analyserCleanupRef.current = () => {
      clearInterval(id);
      setLevel(0);
      try { ctx.close(); } catch {}
    };
  }

  function clearTimers() {
    if (stopTimeoutRef.current) { clearTimeout(stopTimeoutRef.current); stopTimeoutRef.current = 0; }
    try { analyserCleanupRef.current(); } catch {}
    analyserCleanupRef.current = () => {};
    stopLivePreview();
  }

  async function startRec() {
    try {
      if (!cleanTarget) { setError("target is empty. pick a line first."); return; }
      setError(""); setCoachError(""); setResult(null); setStatus("requesting microphone");

      if (!mics.length) {
        try { await navigator.mediaDevices.getUserMedia({ audio: true }); } catch {}
        try {
          const devs = await navigator.mediaDevices.enumerateDevices();
          const inputs = devs.filter((d) => d.kind === "audioinput");
          setMics(inputs);
          if (!deviceId && inputs[0]?.deviceId) setDeviceId(inputs[0].deviceId);
        } catch {}
      }

      const constraints = deviceId ? { audio: { deviceId } } : { audio: true };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);

      if (!window.MediaRecorder) {
        setError("media recorder not available in this browser");
        return;
      }

      const mime = pickPreferredMime();
      const mr = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);

      startSilenceDetector(stream);
      stopTimeoutRef.current = setTimeout(() => {
        if (recRef.current?.state === "recording") recRef.current.stop();
      }, 8000);

      chunksRef.current = [];
      mr.onstart = () => setStatus(`recording ${mr.mimeType || "default"}`);
      mr.ondataavailable = (e) => e.data?.size && chunksRef.current.push(e.data);
      mr.onerror = (e) => setError(e.error?.message || e.name || "recorder error");
      mr.onstop = async () => {
        try {
          setRecording(false);
          clearTimers();
          setStatus("scoring");
          stopLivePreview();
          const mimeType = mr.mimeType || "audio/webm";
          const blob = new Blob(chunksRef.current, { type: mimeType });

          if (!blob || blob.size === 0) {
            setError("recording was empty. please allow mic and try again.");
            setStatus("ready");
            return;
          }

          if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
          audioUrlRef.current = URL.createObjectURL(blob);
          if (visiblePlayerRef.current) visiblePlayerRef.current.src = audioUrlRef.current;

          const wasEnrolling = enrollmentMode || (!enrolled && samples < 3);
          if (wasEnrolling) {
            try {
              const er = await enrollVoice({ blob });
              const nextSamples = Number(er?.samples ?? samples + 1);
              const nowEnrolled = !!er?.enrolled || nextSamples >= 2;
              const nextCount = enrollCount + 1;
              setSamples(nextSamples);
              setEnrolled(nowEnrolled);
              setEnrollCount(nextCount);
              if (nowEnrolled || nextCount >= 2) {
                setEnrollmentMode(false);
                setShowEnrollModal(false);
                setPhraseMsg("voice profile ready");
                setTimeout(() => setPhraseMsg(""), 2000);
              }
            } catch (e) {
              console.warn("[voice] enroll failed", e);
              setError(e?.message || "enroll failed. please try again.");
            }
          }

          const tAssess = performance.now();
          const data = await assessAudio({
            blob,
            target: cleanTarget,
            lang,
            beam,
            vad: 0,
            temperature: debugMode ? 0.2 : 0,
          });
          const clientLatencyMs = Math.round(performance.now() - tAssess);
          setResult(data);

          const hardNow = extractHardWords(data);
          const payload = {
            target: cleanTarget, lang,
            accuracy: data.accuracy, wer: data.wer, duration: data.duration,
            words: data.words, transcript: data.transcript,
            hardWords: hardNow,
            latencyMs: clientLatencyMs,
            serverLatencyMs: data.latency_ms ?? null,
            transcribeMs: data.transcribe_ms ?? null,
            scoreMs: data.score_ms ?? null,
            transcribeAttempts: data.transcribe_attempts ?? null,
            avgConfidence: data.avg_confidence ?? null,
            accent: data.accent ?? null,
            accentConfidence: data.accent_confidence ?? null,
            studyTag,
            sessionId,
            settings: { beam, vad: 0 },
          };
          try { await saveAttempt(payload); } catch { addGuestAttempt(payload); }

          await refreshSummary(50);
          // voice security
          if (user && enrolled && !wasEnrolling) {
            try {
              const vr = await verifyVoice({ blob });
              const score = typeof vr?.score === "number" ? vr.score : 0;
              const match = vr?.match === true && score >= 0.6;
              if (!match) {
                const nextStrike = securityStrikes + 1;
                setSecurityStrikes(nextStrike);
                if (nextStrike === 1) {
                  alert("voice does not match the enrolled profile. if this is your account please speak normally and try again.");
                } else if (nextStrike >= 2) {
                  alert("for security your account will be signed out.");
                  try { await signOut(auth); } catch {}
                  navigate("/login");
                  return;
                }
              } else if (securityStrikes !== 0) {
                setSecurityStrikes(0);
              }
            } catch (e) {
              console.warn("[voice] verify failed", e);
              setCoachError("voice check failed. will try again next time.");
            }
          }

          setStatus("done");
        } catch (err) {
          setError(String(err));
          setStatus("upload failed");
        }
      };

      mr.start();
      recRef.current = mr;
      setRecording(true);
      if (livePreviewEnabled) startLivePreview();
    } catch {
      setError("mic blocked. allow microphone in the address bar.");
      setStatus("mic permission needed");
    }
  }

  function stopRec() {
    try {
      if (recRef.current && recRef.current.state !== "inactive") {
        recRef.current.stop();
      }
    } catch {}
    setRecording(false);
    stopLivePreview();
  }

  function reset() {
    setResult(null); setError(""); setCoachError(""); setStatus("ready"); setRecording(false);
    setLivePreviewText("");
    setLivePreviewError("");
    chunksRef.current = []; clearTimers();
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = "";
      if (visiblePlayerRef.current) visiblePlayerRef.current.removeAttribute("src");
    }
  }

  function randomPhrase() {
    const arr = PHRASES[difficulty];
    setTarget(arr[Math.floor(Math.random() * arr.length)]);
  }

  async function playEnrollSampleBtn() {
    try {
      const res = await getEnrollSampleUrl();
      if (res?.url) {
        const a = new Audio(res.url);
        a.play().catch(()=>{});
      }
    } catch {}
  }

  async function submitFeedback(e) {
    e.preventDefault();
    setFbStatus("");
    if (!auth.currentUser) {
      setFbStatus("please log in to save feedback.");
      return;
    }
    const payload = {
      usability: Number(fbUsability),
      feedback: Number(fbFeedback),
      speed: Number(fbSpeed),
      satisfaction: Number(fbSatisfaction),
      personalization: Number(fbPersonalization),
      clarity: Number(fbClarity),
      issues: Object.entries(fbIssues).filter(([, v]) => v).map(([k]) => k),
      exampleMistake: String(fbExampleMistake || "").trim().slice(0, 200),
      comment: String(fbComment || "").trim().slice(0, 500),
      attemptsCount: summary?.count ?? null,
      lastTarget: cleanTarget,
      studyTag,
      sessionId,
    };
    try {
      setFbSubmitting(true);
      await saveFeedback(payload);
      setFbStatus("thanks! feedback saved to firebase.");
      setFbComment("");
    } catch (err) {
      setFbStatus(err?.message || "could not save feedback");
    } finally {
      setFbSubmitting(false);
    }
  }

  async function loadStudyStats() {
    setStudyStatsError("");
    if (!auth.currentUser) {
      setStudyStatsError("log in to load study stats.");
      return;
    }
    if (!studyTag.trim()) {
      setStudyStatsError("set a study tag first.");
      return;
    }
    try {
      setStudyStatsLoading(true);
      const data = await getStudySummary({ tag: studyTag.trim() });
      setStudyStats(data);
    } catch (err) {
      setStudyStatsError(err?.message || "failed to load stats");
    } finally {
      setStudyStatsLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 to-indigo-50">
      <TopNav />

      <main className="max-w-6xl mx-auto p-6 space-y-6">
        {showEnrollModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
            <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-3">
              <h2 className="text-xl font-bold text-slate-900">protect your account</h2>
              <p className="text-sm text-slate-700">
                we will record your voice two or three times so we can recognise you in this lab.
              </p>
              <ul className="text-sm text-slate-600 list-disc pl-5 space-y-1">
                <li>tap start and read your target sentence</li>
                <li>repeat once more for a clear profile</li>
              </ul>
              <button
                onClick={() => { setEnrollmentMode(true); startRec(); }}
                className="w-full px-4 py-2 rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-700"
              >
                start first recording
              </button>
              <p className="text-xs text-slate-500">enrollments done: {enrollCount}</p>
            </div>
          </div>
        )}

        {/* header strip */}
        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-sm text-gray-500">lab</div>
              <div className="text-2xl font-semibold">pronunciation</div>
            </div>
            <div className="flex items-center gap-3">
              {auth.currentUser ? (
                enrolled ? (
                  <span className="px-2 py-1 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 text-sm">
                    voice profile active. we may log out if voice does not match.
                  </span>
                ) : (
                  <span className="px-2 py-1 rounded bg-amber-50 text-amber-800 border border-amber-200 text-sm">
                    two quick clips will enroll your voice for extra security.
                  </span>
                )
              ) : (
                <span className="px-2 py-1 rounded bg-gray-50 text-gray-700 border border-gray-200 text-sm">
                  sign in to enable voice security
                </span>
              )}
              {auth.currentUser && enrolled && (
                <button
                  onClick={playEnrollSampleBtn}
                  className="px-3 py-1.5 rounded border bg-white text-sm hover:bg-gray-50"
                >
                  hear my enroll sample
                </button>
              )}
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-gray-600">
            <div className="px-3 py-1 rounded-lg bg-slate-100 border border-slate-200">
              mic status: {mics.length ? "ready" : "not detected"}
            </div>
            <div className="px-3 py-1 rounded-lg bg-slate-100 border border-slate-200">
              recorder: {status}
            </div>
          </div>
        </section>

        {/* controls */}
        <SectionCard
          title="controls"
          right={
            <button className="text-sm text-indigo-700" onClick={() => setShowAdvanced(v => !v)}>
              {showAdvanced ? "hide advanced" : "advanced"}
            </button>
          }
        >
          <div className="space-y-3">
            {/* target row */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
              <label className="sm:w-24 text-sm text-gray-600">target</label>
              <div className="flex-1 min-w-0 flex gap-2">
                <select
                  key={`select-${difficulty}-${PHRASES[difficulty].join(",")}`}
                  className="w-full min-w-0 border rounded px-2 py-1"
                  value={target}
                  onChange={(e) => setTarget(e.target.value.trim())}
                >
                  {(() => {
                    const arr = PHRASES[difficulty];
                    const inPresets = arr.includes(target);
                    return (
                      <>
                        {!inPresets && <option value={target}>[custom] {target}</option>}
                        {arr.map((p) => <option key={p} value={p}>{p}</option>)}
                      </>
                    );
                  })()}
                </select>
                <button className="px-3 py-1 border rounded text-sm shrink-0" onClick={randomPhrase}>random</button>
                <button
                  className="px-3 py-1 border rounded text-sm shrink-0"
                  onClick={() => playTarget(target, "en US", voices, visiblePlayerRef.current)}
                >
                  play
                </button>
              </div>
            </div>

            {/* difficulty and lang */}
            <div className="grid gap-3 md:grid-cols-2">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                <label className="sm:w-24 text-sm text-gray-600">difficulty</label>
                <div className="flex items-center gap-2">
                  <select className="border rounded px-2 py-1" value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
                    <option value="simple">simple</option>
                    <option value="medium">medium</option>
                    <option value="hard">hard</option>
                    <option value="study">study (chapter 6)</option>
                  </select>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                <label className="sm:w-24 text-sm text-gray-600">lang</label>
                <select className="border rounded px-2 py-1" value={lang} onChange={(e) => setLang(e.target.value)}>
                  <option value="en">english</option>
                  <option value="multi">multilingual</option>
                </select>
              </div>
            </div>

            {/* your phrases */}
            <div className="pt-3 mt-2 border-t border-gray-100">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-medium text-gray-900 text-sm">your phrases</h4>
                {phraseMsg && <span className="text-xs px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">{phraseMsg}</span>}
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text" maxLength={200}
                  placeholder="type a phrase you want to practice"
                  value={customText} onChange={(e) => setCustomText(e.target.value)}
                  className="flex-1 border rounded px-3 py-2"
                />
                <button
                  onClick={async () => {
                    try {
                      const clean = (customText || "").trim().replace(/\s+/g, " ");
                      if (clean) setTarget(clean);
                      const res = await addUserPhrase({ text: clean, lang });
                      setCustomText("");
                      setPhraseMsg(res?.saved === "cloud" ? "saved in cloud" : "saved");
                      await refreshPhrases();
                    } catch (e) {
                      setPhraseMsg(e.message || "could not save phrase");
                    } finally {
                      setTimeout(() => setPhraseMsg(""), 1500);
                    }
                  }}
                  className="px-3 py-2 rounded bg-indigo-600 text-white disabled:opacity-50"
                  disabled={!customText.trim()}
                >save</button>
              </div>
              <div className="mt-3">
                {loadingList ? (
                  <div className="text-xs text-gray-500">loading your phrases</div>
                ) : savedPhrases.length > 0 ? (
                  <div className="space-y-2 max-h-40 overflow-auto pr-1">
                    {savedPhrases.map((p) => (
                      <div key={p.id} className="flex items-start gap-2">
                        <button
                          type="button"
                          className="flex-1 text-left px-3 py-2 rounded border hover:bg-indigo-50"
                          onClick={() => { setTarget(p.text); if (p.lang && p.lang !== lang) setLang(p.lang); }}
                          title="set as target"
                        >
                          <div className="text-sm break-words">{p.text}</div>
                          <div className="text-[11px] text-gray-500 mt-0.5">lang {p.lang || "en"}</div>
                        </button>
                        <div className="flex gap-1">
                          <button onClick={() => { setTarget(p.text); if (p.lang && p.lang !== lang) setLang(p.lang); }} className="px-2 py-1 rounded border text-xs hover:bg-gray-50">use</button>
                          <button onClick={async () => { await deleteUserPhrase(p.id); setSavedPhrases(prev => prev.filter(x => x.id !== p.id)); }} className="px-2 py-1 rounded border text-xs text-rose-700 hover:bg-rose-50">delete</button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-gray-500">save phrases you want to practice. click one to use it.</div>
                )}
              </div>

              {showAdvanced && (
                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <label className="w-24 text-sm text-gray-600">beam</label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    className="border rounded px-2 py-1 w-24"
                    value={beam}
                    onChange={(e) => {
                      const next = Number(e.target.value);
                      const safe = Number.isFinite(next) ? Math.min(10, Math.max(1, next)) : 5;
                      setBeam(safe);
                    }}
                  />
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={debugMode} onChange={(e) => setDebugMode(e.target.checked)} /> debug
                  </label>
                  <span className="text-xs text-gray-500">vad stays off on server</span>
                </div>
              )}
            </div>
          </div>
        </SectionCard>

        {/* record */}
        <SectionCard title="record" right={<span className="text-sm text-gray-500">{status}</span>}>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3">
              {!recording ? (
                <button
                  onClick={startRec}
                  className="px-6 py-3 rounded-lg bg-black text-white text-lg shadow hover:opacity-90"
                  disabled={!mics.length || !cleanTarget || showEnrollModal}
                >
                  start
                </button>
              ) : (
                <button onClick={stopRec} className="px-6 py-3 rounded-lg bg-rose-600 text-white text-lg shadow hover:opacity-90">stop</button>
              )}
              <button onClick={reset} className="px-4 py-2 rounded-lg border bg-white hover:bg-gray-50">reset</button>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={livePreviewEnabled}
                  onChange={(e) => setLivePreviewEnabled(e.target.checked)}
                  disabled={!previewSupported}
                />
                live mic preview (beta)
              </label>
            </div>
            <audio ref={visiblePlayerRef} controls className="h-9 w-full sm:w-auto" />
          </div>

          {/* mic level */}
          <div className="mt-4">
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div className="h-2 bg-indigo-500 transition-[width] duration-75" style={{ width: `${Math.round(level * 100)}%` }} />
            </div>
            <div className="text-xs text-gray-500 mt-1">mic level</div>
          </div>

          {error && <div className="mt-3 p-2 rounded bg-rose-50 text-rose-700 border border-rose-200 text-sm">{error}</div>}

          {livePreviewEnabled && (
            <div className="mt-3 p-3 rounded-lg border border-emerald-100 bg-emerald-50 text-sm text-emerald-900">
              <div className="font-semibold text-emerald-900 mb-1">mic preview (browser)</div>
              <div className="whitespace-pre-wrap break-words">
                {livePreviewText || (previewSupported ? "listening..." : "preview not supported")}
              </div>
              {livePreviewError && (
                <div className="mt-1 text-xs text-rose-700">{livePreviewError}</div>
              )}
            </div>
          )}
        </SectionCard>

        {/* results and coach */}
        {result && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
            <SectionCard title="results">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm font-semibold">
                score {(result.accuracy * 100).toFixed(0)}%
              </span>
              <span className="px-3 py-1 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 text-sm">
                wer {(result.wer * 100).toFixed(1)}%
              </span>
              {result.duration != null && (
                <span className="px-3 py-1 rounded-full bg-slate-100 border border-slate-200 text-slate-700 text-sm">
                  dur {result.duration.toFixed(2)}s
                </span>
              )}
              {result.accent ? (
                <span className="px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-sm">
                  accent {result.accent}
                  {typeof result.accent_confidence === "number" && ` (${Math.round(result.accent_confidence * 100)}%)`}
                </span>
              ) : (
                <span className="px-3 py-1 rounded-full bg-slate-100 border border-slate-200 text-slate-600 text-sm">
                  accent undetermined
                </span>
              )}
              <span className="text-xs text-gray-500">({langLabel}, beam {beam})</span>
            </div>

              <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                {(() => {
                  const wordsCount = (result.words || []).filter((w) => w.status !== "insertion").length;
                  const durationSec = Number(result.duration || 0);
                  const wordsPerSecond = durationSec > 0 ? wordsCount / durationSec : 0;
                  const paceLabel =
                    wordsPerSecond < 1.5
                      ? "slow and careful"
                      : wordsPerSecond <= 2.5
                      ? "comfortable pace"
                      : "a bit fast";
                  const paceNote =
                    wordsPerSecond > 2.5
                      ? "try not to rush your words"
                      : wordsPerSecond < 1.5
                      ? "aim for a steady flow"
                      : "";
                  const barWidth = Math.min(100, Math.max(10, Math.round((wordsPerSecond / 3) * 100)));
                  return (
                    <>
                      <div className="flex items-center justify-between text-sm text-slate-700">
                        <span className="font-semibold">fluency</span>
                        <span className="text-xs text-slate-500">{wordsCount} words · {durationSec > 0 ? durationSec.toFixed(1) : "0.0"}s</span>
                      </div>
                      <div className="mt-2 flex items-center gap-2 text-slate-800">
                        <span className="text-sm">pace: {paceLabel}</span>
                        <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                          <div className="h-full bg-indigo-500" style={{ width: `${barWidth}%` }} />
                        </div>
                      </div>
                      {paceNote && <div className="mt-1 text-xs text-slate-500">{paceNote}</div>}
                    </>
                  );
                })()}
              </div>

              <div className="mt-3">
                <div className="text-sm text-gray-500 mb-1">transcript click a word to replay that span</div>
                <div className="flex flex-wrap break-words">
                  {result.words.map((w, i) => (
                    <Chip key={i} w={w} onClick={() => {
                      const s = w.start, e = w.end;
                      if (!visiblePlayerRef.current || s == null || e == null) return;
                      const el = visiblePlayerRef.current;
                      el.currentTime = Math.max(0, s);
                      el.play();
                      const id = setInterval(() => {
                        if (el.currentTime >= e) { el.pause(); clearInterval(id); }
                      }, 20);
                    }} />
                  ))}
                </div>
              </div>

              {extractHardWords(result).length > 0 && (
                <div className="mt-3">
                  <div className="text-sm text-gray-500 mb-1">needs work</div>
                  <div className="flex flex-wrap gap-1">
                    {extractHardWords(result).map((w) => (
                      <button key={w} className="px-2 py-1 text-sm rounded border hover:bg-indigo-50" onClick={() => setTarget(w)} title="practice this word">
                        {w}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {accentTipsFor(result.accent).length > 0 && (
                <div className="mt-3">
                  <div className="text-sm text-gray-500 mb-1">accent tip</div>
                  <ul className="list-disc list-inside text-sm text-slate-700 space-y-1">
                    {accentTipsFor(result.accent).map((line, i) => (
                      <li key={i}>{line}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="mt-3 text-xs text-gray-500 flex flex-wrap gap-3">
                <span className="inline-flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-full bg-green-100 border border-green-300" /> correct</span>
                <span className="inline-flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-full bg-amber-100 border border-amber-300" /> substitution</span>
                <span className="inline-flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-full bg-sky-100 border border-sky-300" /> insertion</span>
                <span className="inline-flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-full bg-rose-100 border border-rose-300" /> deletion</span>
              </div>

              {result?.debug && (
                <div className="mt-3">
                  <div className="text-sm text-gray-500 mb-1">debug</div>
                  <pre className="text-xs bg-gray-50 border border-gray-200 rounded p-2 overflow-x-auto">
                    {JSON.stringify(result.debug, null, 2)}
                  </pre>
                </div>
              )}
            </SectionCard>

            <SectionCard
              title="coach"
              right={
                <button className="px-3 py-1 border rounded text-sm bg-white hover:bg-gray-50" onClick={() => refreshSummary(50)}>
                  refresh
                </button>
              }
            >
              {coachError && (
                <div className="mb-3 p-2 rounded bg-amber-50 text-amber-800 border border-amber-200 text-sm">
                  {coachError}
                </div>
              )}

              {summary ? (
                <>
                  <div className="flex flex-wrap gap-4 text-sm mb-3">
                    <div>attempts <strong>{summary.count}</strong></div>
                    <div>avg accuracy <strong>{summary.avgAccuracy == null ? "—" : Math.round(summary.avgAccuracy * 100) + "%"}</strong></div>
                    <div>streak <strong>{summary.streakDays || 0} day{(summary.streakDays||0) === 1 ? "" : "s"}</strong></div>
                  </div>

                  {(() => {
                    const avg = typeof summary.avgAccuracy === "number" ? summary.avgAccuracy : null;
                    let coachLine = "keep phrases short and speak slowly. focus on clear sounds.";
                    if (avg != null) {
                      if (avg >= 0.85) coachLine = "nice accuracy. try longer sentences or faster speech for a challenge.";
                      else if (avg >= 0.7) coachLine = "you are on the right track. repeat hard words and use simple full sentences.";
                    }
                    return (
                      <div className="mb-3 px-3 py-2 rounded-lg bg-indigo-50 border border-indigo-100 text-sm text-indigo-800">
                        {coachLine}
                      </div>
                    );
                  })()}

                  {summary.recent?.length > 0 && (
                    <div className="mb-3">
                      <div className="text-sm text-gray-600 mb-1">recent accuracy</div>
                      <ProgressBars values={summary.recent} />
                    </div>
                  )}

                  {(summary.hardestWords?.length > 0 || getGuestHardWords(10).length > 0) && (
                    <div className="mb-2">
                      <div className="text-sm text-gray-600 mb-1">hardest words</div>
                      <div className="flex flex-wrap gap-1">
                        {(summary.hardestWords?.length ? summary.hardestWords : getGuestHardWords(10)).map((w) => (
                          <button
                            key={w}
                            className="px-2 py-1 text-sm rounded border hover:bg-indigo-50"
                            onClick={() => setTarget(w)}
                            title="practice this word"
                          >
                            {w}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {summary.suggestedPhrases?.length > 0 && (
                    <div>
                      <div className="text-sm text-gray-600 mb-1">suggested next phrases</div>
                      <div className="flex flex-wrap gap-2">
                        {summary.suggestedPhrases.map((p) => (
                          <button
                            key={p}
                            className="px-3 py-1 rounded border text-sm bg-white hover:bg-indigo-50"
                            onClick={() => setTarget(p)}
                            title="set as new target"
                          >
                            {p}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-sm text-gray-500">complete an attempt to unlock personalized tips.</div>
              )}
            </SectionCard>

            <SectionCard title="help">
              <ul className="text-sm text-gray-600 list-disc pl-5 space-y-1">
                <li>press start, speak clearly, then pause. it auto stops after silence.</li>
                <li>click a word chip to replay that span, then practice only that word.</li>
                <li>save your own phrases and train them often.</li>
              </ul>
            </SectionCard>
          </div>
        )}

        <SectionCard title="session feedback">
          <form className="space-y-4" onSubmit={submitFeedback}>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
                <div className="text-slate-700">
                  attempts logged: <strong>{summary?.count ?? 0}</strong>
                </div>
                <div className="text-xs text-slate-500">saved to firebase when logged in</div>
              </div>

              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <label className="flex items-center justify-between gap-3 text-sm text-slate-700">
                  <span>study tag</span>
                  <input
                    className="w-40 rounded border border-slate-300 bg-white px-2 py-1 focus:border-emerald-500 focus:outline-none"
                    value={studyTag}
                    onChange={(e) => setStudyTag(e.target.value.trim())}
                    placeholder="prem"
                    maxLength={40}
                  />
                </label>
                <div className="text-sm text-slate-600 flex items-center justify-between gap-3">
                  <span>session id</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs bg-white border border-slate-200 px-2 py-1 rounded">{sessionId}</span>
                    <button
                      type="button"
                      className="px-2 py-1 text-xs rounded border border-slate-300 bg-white hover:bg-slate-100"
                      onClick={() => setSessionId(makeSessionId())}
                    >
                      new session
                    </button>
                  </div>
                </div>
              </div>

              <div className="mt-4">
                <div className="text-xs uppercase tracking-wide text-slate-500 mb-2">ratings</div>
                <div className="grid gap-3 md:grid-cols-3">
                  <label className="flex items-center justify-between gap-3 text-sm text-slate-700">
                    <span>ease of use</span>
                    <select className="rounded border border-slate-300 bg-white px-2 py-1" value={fbUsability} onChange={(e) => setFbUsability(e.target.value)}>
                      {[1,2,3,4,5].map((n) => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </label>
                  <label className="flex items-center justify-between gap-3 text-sm text-slate-700">
                    <span>feedback helpfulness</span>
                    <select className="rounded border border-slate-300 bg-white px-2 py-1" value={fbFeedback} onChange={(e) => setFbFeedback(e.target.value)}>
                      {[1,2,3,4,5].map((n) => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </label>
                  <label className="flex items-center justify-between gap-3 text-sm text-slate-700">
                    <span>speed</span>
                    <select className="rounded border border-slate-300 bg-white px-2 py-1" value={fbSpeed} onChange={(e) => setFbSpeed(e.target.value)}>
                      {[1,2,3,4,5].map((n) => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </label>
                  <label className="flex items-center justify-between gap-3 text-sm text-slate-700">
                    <span>overall satisfaction</span>
                    <select className="rounded border border-slate-300 bg-white px-2 py-1" value={fbSatisfaction} onChange={(e) => setFbSatisfaction(e.target.value)}>
                      {[1,2,3,4,5].map((n) => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </label>
                  <label className="flex items-center justify-between gap-3 text-sm text-slate-700">
                    <span>personalization</span>
                    <select className="rounded border border-slate-300 bg-white px-2 py-1" value={fbPersonalization} onChange={(e) => setFbPersonalization(e.target.value)}>
                      {[1,2,3,4,5].map((n) => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </label>
                  <label className="flex items-center justify-between gap-3 text-sm text-slate-700">
                    <span>clarity of feedback</span>
                    <select className="rounded border border-slate-300 bg-white px-2 py-1" value={fbClarity} onChange={(e) => setFbClarity(e.target.value)}>
                      {[1,2,3,4,5].map((n) => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </label>
                </div>
              </div>

              <div className="mt-4">
                <div className="text-xs uppercase tracking-wide text-slate-500 mb-2">issues noticed</div>
                <div className="grid gap-2 sm:grid-cols-2 text-sm text-slate-700">
                  {[
                    ["slow_response", "response felt slow"],
                    ["wrong_word_flagged", "wrong word flagged"],
                    ["unclear_tip", "tip was unclear"],
                    ["ui_confusing", "UI was confusing"],
                    ["noise_issue", "background noise affected result"],
                    ["mic_issue", "microphone issue"],
                  ].map(([key, label]) => (
                    <label key={key} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-200"
                        checked={!!fbIssues[key]}
                        onChange={() => setFbIssues((prev) => ({ ...prev, [key]: !prev[key] }))}
                      />
                      <span>{label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <div>
                  <label className="block text-sm text-slate-700 mb-1">example mistake (optional)</label>
                  <input
                    className="w-full rounded border border-slate-300 bg-white px-3 py-2"
                    maxLength={200}
                    value={fbExampleMistake}
                    onChange={(e) => setFbExampleMistake(e.target.value)}
                    placeholder="e.g., misheard 'train' as 'drain'"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-700 mb-1">comment (optional)</label>
                  <textarea
                    className="w-full rounded border border-slate-300 bg-white px-3 py-2 min-h-[90px]"
                    maxLength={500}
                    value={fbComment}
                    onChange={(e) => setFbComment(e.target.value)}
                    placeholder="what worked well? what should improve?"
                  />
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
                <button
                  type="submit"
                  disabled={fbSubmitting || !auth.currentUser}
                  className="px-4 py-2 rounded bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  {fbSubmitting ? "saving..." : "submit feedback"}
                </button>
                {!auth.currentUser && (
                  <span className="text-amber-700">log in to save feedback to firebase.</span>
                )}
                {fbStatus && <span className="text-slate-600">{fbStatus}</span>}
              </div>
            </div>
          </form>
          <div className="mt-5 rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm font-semibold text-slate-800">study stats (firestore)</div>
              <button
                type="button"
                onClick={loadStudyStats}
                className="px-3 py-1.5 text-xs rounded border border-slate-300 bg-slate-50 hover:bg-slate-100"
                disabled={studyStatsLoading}
              >
                {studyStatsLoading ? "loading..." : "refresh stats"}
              </button>
            </div>
            {studyStatsError && (
              <div className="mt-2 text-xs text-rose-700">{studyStatsError}</div>
            )}
            {studyStats ? (
              <div className="mt-3 space-y-4 text-sm text-slate-700">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <div>attempts: <strong>{studyStats.attemptsCount ?? 0}</strong></div>
                  <div>avg accuracy: <strong>{typeof studyStats.avgAccuracy === "number" ? `${Math.round(studyStats.avgAccuracy * 100)}%` : "—"}</strong></div>
                  <div>avg WER: <strong>{typeof studyStats.avgWer === "number" ? studyStats.avgWer.toFixed(3) : "—"}</strong></div>
                  <div>avg latency: <strong>{typeof studyStats.avgLatencyMs === "number" ? `${Math.round(studyStats.avgLatencyMs)} ms` : "—"}</strong></div>
                  <div>pass rate ≥ {studyStats.passThreshold ?? 0.8}: <strong>{typeof studyStats.passCount === "number" && typeof studyStats.attemptsCount === "number" && studyStats.attemptsCount > 0 ? `${Math.round((studyStats.passCount / studyStats.attemptsCount) * 100)}%` : "—"}</strong></div>
                  <div>accuracy delta: <strong>{typeof studyStats.accuracyDelta === "number" ? studyStats.accuracyDelta.toFixed(3) : "—"}</strong></div>
                </div>

                <div>
                  <div className="text-xs uppercase tracking-wide text-slate-500 mb-1">error counts</div>
                  <div className="flex flex-wrap gap-3 text-xs">
                    {Object.entries(studyStats.errorCounts || {}).map(([k, v]) => (
                      <span key={k} className="px-2 py-1 rounded bg-slate-100 border border-slate-200">{k}: {v}</span>
                    ))}
                    {!Object.keys(studyStats.errorCounts || {}).length && (
                      <span className="text-slate-500">no error data</span>
                    )}
                  </div>
                </div>

                <div>
                  <div className="text-xs uppercase tracking-wide text-slate-500 mb-1">top hard words</div>
                  <div className="flex flex-wrap gap-2 text-xs">
                    {(studyStats.hardWordsTop || []).map((row) => (
                      <span key={row.word} className="px-2 py-1 rounded bg-slate-100 border border-slate-200">{row.word} ×{row.count}</span>
                    ))}
                    {!studyStats.hardWordsTop?.length && (
                      <span className="text-slate-500">no hard words</span>
                    )}
                  </div>
                </div>

                <div>
                  <div className="text-xs uppercase tracking-wide text-slate-500 mb-1">feedback averages</div>
                  <div className="grid gap-2 sm:grid-cols-3 text-xs">
                    <span>usability: <strong>{studyStats.feedback?.usability?.toFixed?.(2) ?? "—"}</strong></span>
                    <span>helpfulness: <strong>{studyStats.feedback?.feedback?.toFixed?.(2) ?? "—"}</strong></span>
                    <span>speed: <strong>{studyStats.feedback?.speed?.toFixed?.(2) ?? "—"}</strong></span>
                    <span>satisfaction: <strong>{studyStats.feedback?.satisfaction?.toFixed?.(2) ?? "—"}</strong></span>
                    <span>personalization: <strong>{studyStats.feedback?.personalization?.toFixed?.(2) ?? "—"}</strong></span>
                    <span>clarity: <strong>{studyStats.feedback?.clarity?.toFixed?.(2) ?? "—"}</strong></span>
                  </div>
                </div>

                <div>
                  <div className="text-xs uppercase tracking-wide text-slate-500 mb-1">feedback issues</div>
                  <div className="flex flex-wrap gap-2 text-xs">
                    {Object.entries(studyStats.issues || {}).map(([k, v]) => (
                      <span key={k} className="px-2 py-1 rounded bg-slate-100 border border-slate-200">{k}: {v}</span>
                    ))}
                    {!Object.keys(studyStats.issues || {}).length && (
                      <span className="text-slate-500">no issues reported</span>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-2 text-sm text-slate-500">refresh to load stats for the current study tag.</div>
            )}
          </div>
        </SectionCard>

        <div className="mt-6 text-xs text-gray-500 p-3 rounded bg-blue-50 border border-blue-200">
          <strong className="text-blue-700">voice data privacy</strong> audio is sent for scoring and deleted at once. only scores and error tags are stored for your progress. enrollment clips are kept to protect your account.
        </div>
      </main>
    </div>
  );
}
