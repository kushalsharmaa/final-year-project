# backend/assessment.py
from typing import List, Dict, Any
import string

def _normalize(s: str) -> str:
    # keep original casing but collapse spaces
    return " ".join((s or "").strip().split())

def _normalize_word_token(word: str) -> str:
    """Lowercase and strip common punctuation from word edges."""
    return (word or "").strip().lower().strip(string.punctuation + "“”‘’")

def _build_ref_tokens(text: str):
    tokens = []
    for raw in (text or "").strip().split():
        norm = _normalize_word_token(raw)
        if norm:
            tokens.append({"orig": raw, "norm": norm})
    return tokens

def _align_ops(reference_words, hypothesis_words):
    """Dynamic program alignment with ops to label every word."""
    n, m = len(reference_words), len(hypothesis_words)
    dp = [[0] * (m + 1) for _ in range(n + 1)]
    op = [[None] * (m + 1) for _ in range(n + 1)]

    for i in range(1, n + 1):
        dp[i][0], op[i][0] = i, "del"
    for j in range(1, m + 1):
        dp[0][j], op[0][j] = j, "ins"

    for i in range(1, n + 1):
        for j in range(1, m + 1):
            cost = 0 if reference_words[i - 1]["norm"] == hypothesis_words[j - 1]["norm"] else 1
            choices = [
                (dp[i - 1][j] + 1, "del"),
                (dp[i][j - 1] + 1, "ins"),
                (dp[i - 1][j - 1] + cost, "ok" if cost == 0 else "sub"),
            ]
            dp[i][j], op[i][j] = min(choices, key=lambda x: x[0])

    i, j = n, m
    statuses = [None] * m
    while i > 0 or j > 0:
        cur = op[i][j]
        if cur == "ok":
            statuses[j - 1] = ("correct", reference_words[i - 1]["orig"]); i -= 1; j -= 1
        elif cur == "sub":
            statuses[j - 1] = ("substitution", reference_words[i - 1]["orig"]); i -= 1; j -= 1
        elif cur == "ins":
            statuses[j - 1] = ("insertion", None); j -= 1
        else:
            statuses.insert(j, ("deletion", reference_words[i - 1]["orig"])); i -= 1
    return statuses

def process_assessment_from_whisper(target: str, segments: List[Any]) -> Dict[str, Any]:
    """
    Build transcript from Whisper segments, align to target,
    compute accuracy and tips, return json safe dict.
    """
    # collect parts and word timing
    parts = []
    words = []
    start = end = None

    for seg in segments:
        txt = (getattr(seg, "text", "") or "").strip()
        if txt:
            parts.append(txt)
        seg_words = getattr(seg, "words", []) or []
        for w in seg_words:
            wt = (getattr(w, "word", "") or "").strip()
            ws = getattr(w, "start", None)
            we = getattr(w, "end", None)
            prob = float(getattr(w, "probability", 0.0) or 0.0)
            words.append({
                "text": wt,
                "norm": _normalize_word_token(wt),
                "start": float(ws) if ws is not None else None,
                "end": float(we) if we is not None else None,
                "probability": prob
            })
        if seg_words:
            if start is None and seg_words[0].start is not None:
                start = seg_words[0].start
            if seg_words[-1].end is not None:
                end = seg_words[-1].end

    raw_transcript = " ".join(parts).strip()
    transcript = raw_transcript
    ref_tokens = _build_ref_tokens(target)
    hyp_tokens = [w["norm"] for w in words if w.get("norm")]

    # simple WER
    n, m = len(ref_tokens), len(hyp_tokens)
    dp = [[0] * (m + 1) for _ in range(n + 1)]
    for i in range(n + 1): dp[i][0] = i
    for j in range(m + 1): dp[0][j] = j
    for i in range(1, n + 1):
        for j in range(1, m + 1):
            cost = 0 if ref_tokens[i - 1]["norm"] == hyp_tokens[j - 1] else 1
            dp[i][j] = min(
                dp[i - 1][j] + 1,      # deletion
                dp[i][j - 1] + 1,      # insertion
                dp[i - 1][j - 1] + cost  # sub or ok
            )
    wer_val = dp[n][m] / max(1, n)
    accuracy = max(0.0, min(1.0, 1.0 - wer_val))

    # label each word with status
    statuses = _align_ops(ref_tokens, words)
    enriched = []
    hyp_idx = 0
    for typ, expected in statuses:
        if typ == "deletion":
            enriched.append({
                "text": "", "start": None, "end": None, "conf": 0.0,
                "status": "deletion", "expected": expected
            })
        else:
            w = words[hyp_idx] if hyp_idx < len(words) else {"text": "", "start": None, "end": None, "probability": 0.0}
            enriched.append({
                "text": w.get("text"), "start": w.get("start"), "end": w.get("end"),
                "conf": float(w.get("probability", 0.0)), "status": typ, "expected": expected
            })
            hyp_idx += 1

    hard = [w.get("expected") or w.get("text") for w in enriched if w.get("status") in ("substitution", "deletion")]
    tips = []
    if accuracy < 0.7:
        tips.append("Slow down and articulate each word.")
    if wer_val > 0.2:
        tips.append("Listen first and match the rhythm.")
    if hard:
        uniq = ", ".join(sorted(set([h for h in hard if h]))[:5])
        tips.append(f"Practice tricky words: {uniq}.")

    duration = float(max(0.0, (end or 0.0) - (start or 0.0)))

    return {
        "accuracy": round(float(accuracy), 4),
        "wer": round(float(wer_val), 4),
        "transcript": transcript,
        "duration": round(duration, 3),
        "words": enriched,
        "tips": tips,
    }
