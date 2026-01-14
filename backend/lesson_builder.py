# backend/lesson_builder.py
import json
import logging
import os
from datetime import datetime
from typing import Any, Dict, List, Optional

DEFAULT_LEVEL = "b1"
DEFAULT_MODEL = "gpt-4o-mini"


def _safe_list(val: Any) -> List[Any]:
    if not val:
        return []
    if isinstance(val, list):
        return val
    return [val]


def _build_mock_plan(params: Dict[str, Any]) -> Dict[str, Any]:
    """Fallback plan when an LLM is unavailable."""
    goal = params.get("goal") or "sound more natural"
    topic = params.get("topic") or "daily conversation"
    level = params.get("level") or DEFAULT_LEVEL
    duration = int(params.get("durationMinutes") or 20)
    weak_words = _safe_list(params.get("weakWords"))
    weak_pronunciation = _safe_list(params.get("weakPronunciation"))

    focus_words = weak_words[:5] or ["actually", "culture", "comfortably"]
    pron_targets = weak_pronunciation[:3] or [
        "I would like a cup of water.",
        "Could you repeat that slowly?",
        "Thank you for your help today.",
    ]
    sections = [
        {
            "id": "warmup",
            "title": "Warm-up",
            "type": "warmup",
            "summary": "Quick breathing and mouth shape activation to reduce tension.",
            "tasks": [
                "3 deep breaths and slow exhale on 'ssss' for 10 seconds.",
                "Lip trills x 2 and tongue circles each direction x 5.",
                "Shadow this short phrase twice: 'I’m ready to focus now.'",
            ],
        },
        {
            "id": "vocab",
            "title": "Target vocabulary",
            "type": "vocabulary",
            "summary": "Lock in the 3–5 words that will appear in the practice prompt.",
            "tasks": [
                f"Say each word clearly 3x: {', '.join(focus_words)}.",
                "Build a quick sentence for each word. Keep it under 7 words.",
                "Record one sentence and listen back. Adjust any unclear sounds.",
            ],
        },
        {
            "id": "speaking",
            "title": "Main speaking prompt",
            "type": "speaking",
            "summary": "Use the words above in a natural response.",
            "prompt": f"You are talking about {topic}. Answer in 4–6 sentences that show confidence. Mention at least one of: {', '.join(focus_words)}.",
            "rubric": [
                {"label": "Clarity", "detail": "Key vowels/consonants are distinct; no rushing."},
                {"label": "Stress", "detail": "Main content words stressed; endings not dropped."},
                {"label": "Pacing", "detail": "Steady pace with short pauses to breathe."},
            ],
        },
        {
            "id": "pronunciation",
            "title": "Pronunciation drill",
            "type": "pronunciation",
            "summary": "Phrase-level practice to target difficult sounds.",
            "tasks": [
                f"Record each target 2x: {', '.join(pron_targets)}",
                "Check endings and stressed syllables; circle any weak spots.",
                "Record once more with intentional stress and slower pace.",
            ],
        },
        {
            "id": "review",
            "title": "Self-review",
            "type": "review",
            "summary": "Quick reflection to lock in adjustments.",
            "tasks": [
                "Play back your main response and note 1–2 sounds to fix.",
                "Rewrite one sentence to be shorter or clearer.",
                "Set a micro-goal for tomorrow (e.g., repeat drills 2x).",
            ],
        },
    ]

    return {
        "title": f"{goal.title()} lesson on {topic}",
        "goal": goal,
        "topic": topic,
        "level": level,
        "durationMinutes": duration,
        "pronunciationTargets": pron_targets,
        "vocabulary": [{"phrase": w, "tip": "Keep vowels long enough to stay clear."} for w in focus_words],
        "sections": sections,
        "generatedAt": datetime.utcnow().isoformat() + "Z",
        "source": "mock",
    }


def _call_openai(params: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """Call OpenAI if configured; return parsed JSON plan or None on failure."""
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        return None
    try:
        from openai import OpenAI
    except Exception as e:
        logging.warning("openai import failed: %s", e)
        return None

    client = OpenAI(api_key=api_key)
    model = os.environ.get("LESSON_MODEL", DEFAULT_MODEL)

    messages = [
        {
            "role": "system",
            "content": (
                "You are a concise ESL pronunciation coach. "
                "Return strict JSON with a lesson plan for one focused session. "
                "Keep text short and actionable; avoid markdown and line breaks in values."
            ),
        },
        {
            "role": "user",
            "content": json.dumps(
                {
                    "goal": params.get("goal"),
                    "topic": params.get("topic"),
                    "level": params.get("level"),
                    "durationMinutes": params.get("durationMinutes"),
                    "weakWords": _safe_list(params.get("weakWords")),
                    "weakPronunciation": _safe_list(params.get("weakPronunciation")),
                }
            ),
        },
    ]

    try:
        resp = client.chat.completions.create(
            model=model,
            messages=messages,
            response_format={"type": "json_object"},
            max_tokens=900,
            temperature=0.6,
        )
        content = resp.choices[0].message.content
        data = json.loads(content)
        data["source"] = "openai"
        data["model"] = model
        if "generatedAt" not in data:
            data["generatedAt"] = datetime.utcnow().isoformat() + "Z"
        return data
    except Exception as e:
        logging.warning("openai lesson generation failed: %s", e)
        return None


def _normalize_plan(plan: Dict[str, Any], params: Dict[str, Any], used_llm: bool) -> Dict[str, Any]:
    """Ensure required fields exist and types are sane for the frontend."""
    out = dict(plan or {})
    out.setdefault("title", f"{(params.get('goal') or 'Lesson').title()} on {params.get('topic') or 'speaking'}")
    out.setdefault("goal", params.get("goal") or "")
    out.setdefault("topic", params.get("topic") or "")
    out.setdefault("level", params.get("level") or DEFAULT_LEVEL)
    out.setdefault("durationMinutes", params.get("durationMinutes") or 20)
    sections = out.get("sections") or []
    if not isinstance(sections, list):
        sections = [sections]
    out["sections"] = sections
    if "pronunciationTargets" not in out:
        out["pronunciationTargets"] = _safe_list(params.get("weakPronunciation"))
    if "vocabulary" not in out:
        out["vocabulary"] = [
            {"phrase": w, "tip": "Speak slowly and stress the main syllable."}
            for w in _safe_list(params.get("weakWords"))[:5]
        ]
    out.setdefault("generatedAt", datetime.utcnow().isoformat() + "Z")
    out.setdefault("source", "openai" if used_llm else "mock")
    return out


def generate_lesson_plan(params: Dict[str, Any]) -> Dict[str, Any]:
    """
    Build a lesson plan using LLM when available; fallback to a deterministic mock.
    Expected params: goal, topic, level, durationMinutes, weakWords, weakPronunciation.
    """
    plan = _call_openai(params)
    used_llm = plan is not None
    if plan is None:
        plan = _build_mock_plan(params)
    normalized = _normalize_plan(plan, params, used_llm)
    return {"ok": True, "plan": normalized, "using_llm": used_llm}
