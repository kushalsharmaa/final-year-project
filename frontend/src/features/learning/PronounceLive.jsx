import React, { useEffect, useRef, useState } from "react";
// Mocking external dependencies to resolve build errors
// Assuming these dependencies are simple objects or functions needed for compilation
const assessAudio = async ({ blob, target, lang, beam, vad, temperature }) => {
  // Mock API call return structure
  await new Promise(resolve => setTimeout(resolve, 500)); // Simulate network delay
  return {
    accuracy: 85,
    wer: 0.15,
    duration: 3.5,
    transcript: "mock transcript",
    words: [
      { text: "mock", status: "success" },
      { text: "word", status: "substitution", expected: "correct" }
    ]
  };
};
const saveAttempt = async (attempt) => { /* Mock save API */ };
const logLearnEvent = (event, data) => { /* Mock log API */ };
const tagErrors = ({ target, transcript, words }) => {
  // Mock error tagging logic
  return [{ tag: "subst" }];
};


export default function PronounceLive({ phrase, onScored }) {
  const mr = useRef(null);
  const chunks = useRef([]);
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [level, setLevel] = useState(0);      // realtime mic level 0..1
  const [elapsed, setElapsed] = useState(0);  // seconds

  // analyser for live volume
  const audioCtx = useRef(null);
  const analyser = useRef(null);
  const raf = useRef(0);
  const startTs = useRef(0);

  useEffect(() => {
    return () => {
      try { if (mr.current && mr.current.state !== "inactive") mr.current.stop(); } catch {}
      cancelAnimationFrame(raf.current);
      // Clean up on component unmount
      if (audioCtx.current && audioCtx.current.state !== "closed") {
        audioCtx.current.close();
      }
    };
  }, []);

  function pump() {
    const buf = new Uint8Array(analyser.current.frequencyBinCount);
    analyser.current.getByteTimeDomainData(buf);
    // rough RMS
    let sum = 0;
    for (let i = 0; i < buf.length; i++) {
      const v = (buf[i] - 128) / 128;
      sum += v * v;
    }
    const rms = Math.sqrt(sum / buf.length);
    setLevel(Math.min(1, Math.max(0, rms * 3)));
    setElapsed(Math.round((performance.now() - startTs.current) / 1000));
    raf.current = requestAnimationFrame(pump);
  }

  async function start() {
    setError("");
    chunks.current = [];
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // live analyser
      audioCtx.current = new (window.AudioContext || window.webkitAudioContext)();
      analyser.current = audioCtx.current.createAnalyser();
      analyser.current.fftSize = 2048;
      const src = audioCtx.current.createMediaStreamSource(stream);
      src.connect(analyser.current);
      startTs.current = performance.now();
      pump();

      const rec = new MediaRecorder(stream, { mimeType: "audio/webm" });
      mr.current = rec;

      rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.current.push(e.data); };
      
      rec.onstop = async () => {
        cancelAnimationFrame(raf.current);
        
        // >>> START OF REQUESTED CHANGE: Robust Audio Context Cleanup <<<
        try {
          if (audioCtx.current && audioCtx.current.state !== "closed") {
            await audioCtx.current.close();
          }
        } catch {}
        audioCtx.current = null;
        // >>> END OF REQUESTED CHANGE <<<

        setBusy(true);
        try {
          const blob = new Blob(chunks.current, { type: "audio/webm" });
          const res = await assessAudio({
            blob,
            target: phrase,
            lang: "en",
            beam: 5,
            vad: 1,
            temperature: 0,
          });

          // error tags
          const tags = tagErrors({ target: phrase, transcript: res.transcript, words: res.words });

          onScored?.(res);

          // save attempt + tags
          try {
            await saveAttempt({
              target: phrase,
              accuracy: res.accuracy,
              wer: res.wer,
              duration: res.duration,
              transcript: res.transcript,
              hardWords: (res.words || [])
                .filter(w => ["substitution","deletion"].includes(w.status))
                .map(w => w.expected || w.text)
                .filter(Boolean)
                .slice(0, 6),
              errorTags: tags.map(t => t.tag),
            });
          } catch {}

          // log small event
          logLearnEvent?.("pron_attempt", { phrase, acc: res.accuracy, tags: tags.map(t=>t.tag) });

        } catch (e) {
          setError(String(e.message || e));
        } finally {
          setBusy(false);
          setLevel(0);
          setElapsed(0);
        }
      };

      rec.start();
      setRecording(true);

      // auto stop at 6 sec
      setTimeout(() => { try { rec.stop(); } catch {} setRecording(false); }, 6000);
    } catch (e) {
      setError("Microphone access failed: " + (e.message || "Unknown error"));
    }
  }

  function stop() {
    try { mr.current?.stop(); } catch {}
    
    // If the user manually stops, we apply the same robust cleanup logic
    cancelAnimationFrame(raf.current);
    try {
      if (audioCtx.current && audioCtx.current.state !== "closed") {
        audioCtx.current.close();
      }
    } catch {}
    audioCtx.current = null;
    
    setRecording(false);
  }

  const tips =
    level < 0.08 ? "speak a bit closer to the mic" :
    level > 0.7 ? "reduce loudness slightly" :
    "good pace";

  return (
    <div className="p-4 bg-white shadow-lg rounded-xl">
      <div className="text-lg font-semibold text-gray-800 mb-2">Say: “{phrase}”</div>

      {/* live meter */}
      <div className="mb-4">
        <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
          <div 
            className="h-3 bg-indigo-600 transition-all duration-300 ease-out" 
            style={{ width: `${Math.round(level*100)}%` }} 
            role="progressbar"
            aria-valuenow={Math.round(level*100)}
            aria-valuemin="0"
            aria-valuemax="100"
            aria-label="Microphone input level"
          />
        </div>
        <div className="mt-2 text-sm text-gray-600 font-medium">
          {recording ? `Recording ${elapsed}s • ${tips}` : busy ? "Processing recording..." : "Ready to start recording"}
        </div>
      </div>

      <div className="flex items-center gap-3">
        {!recording ? (
          <button 
            className="px-6 py-2 rounded-full font-bold text-white transition-colors duration-200 disabled:opacity-50" 
            style={{ backgroundColor: busy ? '#4B5563' : '#4F46E5' }} 
            onClick={start} 
            disabled={busy}
          >
            {busy ? "Processing…" : "Record"}
          </button>
        ) : (
          <button 
            className="px-6 py-2 rounded-full font-bold text-white bg-rose-600 hover:bg-rose-700 transition-colors duration-200 shadow-md" 
            onClick={stop}
          >
            Stop
          </button>
        )}
        {error && <span className="text-sm text-rose-700 font-medium ml-4 p-2 bg-rose-50 rounded-lg">{error}</span>}
      </div>
    </div>
  );
}