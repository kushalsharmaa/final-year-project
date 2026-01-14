import os
import sys
import tempfile
import logging
import json
import shutil
import time

from flask import Flask, request, jsonify, Blueprint, current_app
from flask_cors import CORS
from werkzeug.utils import secure_filename
from werkzeug.exceptions import HTTPException
from dotenv import load_dotenv

# make local imports work
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

# local modules
from assessment import process_assessment_from_whisper
from lesson_builder import generate_lesson_plan
from accent import AccentDetector

# optional voice blueprint
try:
    from voice_security import voice_bp
except Exception:
    voice_bp = Blueprint("voice_stub", __name__)

# ---------- setup ----------

def setup_logging():
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s: %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )

def init_firebase():
    import firebase_admin
    from firebase_admin import credentials
    from firebase_admin import firestore as fs

    if firebase_admin._apps:
        return fs.client()

    cred = None
    if os.environ.get("GOOGLE_APPLICATION_CREDENTIALS"):
        try:
            cred = credentials.ApplicationDefault()
        except Exception as e:
            logging.error(f"ADC failed: {e}")

    if cred is None:
        sa_path = os.path.join(BASE_DIR, "firebase-service-account.json")
        if os.path.exists(sa_path):
            cred = credentials.Certificate(sa_path)

    if not cred:
        logging.warning("firebase not initialised")
        return None

    try:
        firebase_admin.initialize_app(cred)
        logging.info("firebase initialised")
        return fs.client()
    except Exception as e:
        logging.error(f"firebase init failed: {e}")
        return None

def init_whisper():
    try:
        from faster_whisper import WhisperModel
    except ModuleNotFoundError:
        logging.warning("faster whisper not installed")
        return None

    model_name = os.environ.get("WHISPER_MODEL", "small")
    compute_type = os.environ.get("WHISPER_COMPUTE", "int8")

    try:
        model = WhisperModel(model_name, device="cpu", compute_type=compute_type)
        logging.info(f"whisper loaded: {model_name}")
        return model
    except Exception as e:
        logging.error(f"whisper load failed: {e}")
        return None

# ---------- auth helper ----------

def auth_uid():
    from firebase_admin import auth as admin_auth
    authz = request.headers.get("Authorization", "")
    if not authz.startswith("Bearer "):
        raise ValueError("missing bearer token")
    token = authz.split(" ", 1)[1].strip()
    return admin_auth.verify_id_token(token)["uid"]

# ---------- blueprint ----------

main_bp = Blueprint("main", __name__)

@main_bp.app_errorhandler(HTTPException)
def handle_http(e):
    response = e.get_response()
    response.data = jsonify({"code": e.code, "name": e.name, "description": e.description}).data
    response.content_type = "application/json"
    return response

@main_bp.app_errorhandler(Exception)
def handle_any(e):
    logging.exception("unhandled error")
    return jsonify({"error": "internal error"}), 500


def sse_event(event: str, data: dict) -> str:
    """Build a simple SSE event string."""
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"

@main_bp.get("/api/health")
def health():
    return jsonify({"ok": True})

@main_bp.get("/api/health/whisper")
def health_whisper():
    return jsonify({"loaded": current_app.whisper_model is not None})

@main_bp.post("/api/assess")
def assess():
    t0 = time.perf_counter()
    wm = current_app.whisper_model
    if wm is None:
        return jsonify({"error": "whisper model not available"}), 500

    if "file" not in request.files:
        return jsonify({"error": "no file"}), 400

    # read params from form first then query
    def arg(name, default=None):
        v = request.form.get(name, None)
        if v is None:
            v = request.args.get(name, default)
        return v if v is not None else default

    target = (arg("target", "") or "").strip()
    if not target:
        return jsonify({"error": "missing target"}), 400

    lang = (arg("lang", "en") or "en").strip()

    def as_int(x, dv): 
        try: return int(str(x))
        except: return dv
    def as_float(x, dv):
        try: return float(str(x))
        except: return dv

    beam = as_int(arg("beam", 5), 5)
    # keep VAD off to avoid onnxruntime requirement
    vad_flag = 0
    temperature = as_float(arg("temperature", 0.0), 0.0)

    f = request.files["file"]
    logging.info("assess target=%s lang=%s beam=%s", target, lang, beam)

    try:
        with tempfile.TemporaryDirectory() as td:
            path = os.path.join(td, secure_filename(f.filename or "audio.webm"))
            f.save(path)

            def transcribe(use_vad: bool):
                return wm.transcribe(
                    path,
                    beam_size=beam,
                    vad_filter=True if use_vad else False,
                    temperature=temperature,
                    language=None if lang == "multi" else lang,
                    word_timestamps=True,
                )

            transcribe_attempts = 0
            used_vad = False
            t_transcribe = time.perf_counter()
            try:
                # first try no VAD
                transcribe_attempts += 1
                segments, _ = transcribe(False)
            except Exception as e1:
                logging.warning("first transcribe failed: %s", e1)
                try:
                    # try with VAD only if available
                    transcribe_attempts += 1
                    used_vad = (vad_flag == 1)
                    segments, _ = transcribe(vad_flag == 1)
                except Exception as e2:
                    logging.exception("transcribe failed twice")
                    return jsonify({"error": f"transcribe_failed: {e2}"}), 500
            transcribe_ms = (time.perf_counter() - t_transcribe) * 1000.0

            try:
                t_score = time.perf_counter()
                out = process_assessment_from_whisper(target, segments)
                score_ms = (time.perf_counter() - t_score) * 1000.0
                total_ms = (time.perf_counter() - t0) * 1000.0
                out["latency_ms"] = round(float(total_ms), 2)
                out["transcribe_ms"] = round(float(transcribe_ms), 2)
                out["score_ms"] = round(float(score_ms), 2)
                out["transcribe_attempts"] = transcribe_attempts
                out["vad_used"] = bool(used_vad)
                conf_vals = [
                    w.get("conf") for w in (out.get("words") or [])
                    if isinstance(w, dict) and isinstance(w.get("conf"), (int, float))
                ]
                if conf_vals:
                    out["avg_confidence"] = round(sum(conf_vals) / len(conf_vals), 4)
                # optional accent detection (best-effort, non-blocking)
                try:
                    detector = getattr(current_app, "accent_detector", None)
                    if detector:
                        accent_lbl, accent_conf = detector.detect(path, lang=lang)
                        out["accent"] = accent_lbl
                        if accent_conf is not None:
                            out["accent_confidence"] = round(float(accent_conf), 4)
                except Exception as e_acc:
                    logging.warning("accent detection skipped: %s", e_acc)
                return jsonify(out), 200
            except Exception as e3:
                logging.exception("scoring failed")
                return jsonify({"error": f"scoring_failed: {e3}"}), 500

    except Exception as e:
        logging.exception("assess internal error")
        return jsonify({"error": f"internal_error: {e}"}), 500


@main_bp.post("/api/assess/stream")
def assess_stream():
    """
    SSE streaming version: sends segment events while transcribing, then a final done event with full scoring.
    """
    t0 = time.perf_counter()
    wm = current_app.whisper_model
    if wm is None:
        return jsonify({"error": "whisper model not available"}), 500
    if "file" not in request.files:
        return jsonify({"error": "no file"}), 400

    def arg(name, default=None):
        v = request.form.get(name, None)
        if v is None:
            v = request.args.get(name, default)
        return v if v is not None else default

    target = (arg("target", "") or "").strip()
    if not target:
        return jsonify({"error": "missing target"}), 400
    lang = (arg("lang", "en") or "en").strip()

    def as_int(x, dv):
        try:
            return int(str(x))
        except Exception:
            return dv

    def as_float(x, dv):
        try:
            return float(str(x))
        except Exception:
            return dv

    beam = as_int(arg("beam", 5), 5)
    temperature = as_float(arg("temperature", 0.0), 0.0)

    f = request.files["file"]
    logging.info("assess_stream target=%s lang=%s beam=%s", target, lang, beam)

    tmp_dir = tempfile.mkdtemp()
    path = os.path.join(tmp_dir, secure_filename(f.filename or "audio.webm"))
    try:
        f.save(path)
    except Exception as e_save:
        try:
            shutil.rmtree(tmp_dir, ignore_errors=True)
        except Exception:
            pass
        return jsonify({"error": f"save_failed: {e_save}"}), 500

    def generate():
        try:
            segments_captured = []
            t_transcribe = time.perf_counter()

            try:
                segments_gen, _ = wm.transcribe(
                    path,
                    beam_size=beam,
                    vad_filter=False,
                    temperature=temperature,
                    language=None if lang == "multi" else lang,
                    word_timestamps=True,
                )

                for seg in segments_gen:
                    segments_captured.append(seg)
                    payload = {
                        "text": (getattr(seg, "text", "") or "").strip(),
                        "start": getattr(seg, "start", None),
                        "end": getattr(seg, "end", None),
                        "avg_logprob": getattr(seg, "avg_logprob", None),
                    }
                    yield sse_event("segment", payload)
            except Exception as e_trans:
                logging.exception("stream transcribe failed")
                yield sse_event("error", {"error": f"transcribe_failed: {e_trans}"})
                return
            transcribe_ms = (time.perf_counter() - t_transcribe) * 1000.0

            try:
                t_score = time.perf_counter()
                out = process_assessment_from_whisper(target, segments_captured)
                score_ms = (time.perf_counter() - t_score) * 1000.0
                total_ms = (time.perf_counter() - t0) * 1000.0
                out["latency_ms"] = round(float(total_ms), 2)
                out["transcribe_ms"] = round(float(transcribe_ms), 2)
                out["score_ms"] = round(float(score_ms), 2)
                out["transcribe_attempts"] = 1
                out["vad_used"] = False
                conf_vals = [
                    w.get("conf") for w in (out.get("words") or [])
                    if isinstance(w, dict) and isinstance(w.get("conf"), (int, float))
                ]
                if conf_vals:
                    out["avg_confidence"] = round(sum(conf_vals) / len(conf_vals), 4)
                # optional accent detection
                try:
                    detector = getattr(current_app, "accent_detector", None)
                    if detector:
                        accent_lbl, accent_conf = detector.detect(path, lang=lang)
                        out["accent"] = accent_lbl
                        if accent_conf is not None:
                            out["accent_confidence"] = round(float(accent_conf), 4)
                except Exception as e_acc:
                    logging.warning("accent detection skipped: %s", e_acc)
                yield sse_event("done", out)
            except Exception as e_score:
                logging.exception("stream scoring failed")
                yield sse_event("error", {"error": f"scoring_failed: {e_score}"})
        except Exception as e_outer:
            logging.exception("stream assess failed")
            yield sse_event("error", {"error": f"internal_error: {e_outer}"})
        finally:
            try:
                shutil.rmtree(tmp_dir, ignore_errors=True)
            except Exception:
                pass

    from flask import Response
    return Response(generate(), mimetype="text/event-stream", headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})

# attempts and summary are optional for your smoke test
@main_bp.post("/api/attempts")
def attempts_create():
    from firebase_admin import firestore
    db = current_app.db
    if db is None:
        return jsonify({"error": "firestore not configured"}), 500
    try:
        uid = auth_uid()
    except Exception as e:
        return jsonify({"error": f"unauthorized: {e}"}), 401
    data = request.get_json(silent=True) or {}
    need = ["target", "accuracy", "wer", "duration", "transcript"]
    if not all(k in data for k in need):
        return jsonify({"error": f"missing fields: {need}"}), 400
    data["uid"] = uid
    data["createdAt"] = firestore.SERVER_TIMESTAMP
    if isinstance(data.get("studyTag"), str) and data.get("studyTag"):
        data["studyTag"] = data["studyTag"][:40]
    if isinstance(data.get("sessionId"), str) and data.get("sessionId"):
        data["sessionId"] = data["sessionId"][:64]
    ref = db.collection("attempts").document()
    ref.set(data)
    return jsonify({"ok": True, "id": ref.id}), 201

@main_bp.post("/api/feedback")
def feedback_create():
    from firebase_admin import firestore
    db = current_app.db
    if db is None:
        return jsonify({"error": "firestore not configured"}), 500
    try:
        uid = auth_uid()
    except Exception as e:
        return jsonify({"error": f"unauthorized: {e}"}), 401

    data = request.get_json(silent=True) or {}

    def as_int(val):
        try:
            return int(val)
        except Exception:
            return None

    ratings = {}
    for key in ("usability", "feedback", "speed", "satisfaction"):
        v = as_int(data.get(key))
        if v is None or v < 1 or v > 5:
            return jsonify({"error": f"invalid rating: {key}"}), 400
        ratings[key] = v

    opt_ratings = {}
    for key in ("personalization", "clarity"):
        v = as_int(data.get(key))
        if v is None:
            continue
        if v < 1 or v > 5:
            return jsonify({"error": f"invalid rating: {key}"}), 400
        opt_ratings[key] = v

    comment = (data.get("comment") or "").strip()
    if len(comment) > 500:
        comment = comment[:500]

    payload = {
        "uid": uid,
        "createdAt": firestore.SERVER_TIMESTAMP,
        **ratings,
        **opt_ratings,
        "comment": comment,
        "source": "pronunciation_lab",
    }

    attempts_count = data.get("attemptsCount")
    if isinstance(attempts_count, (int, float)):
        payload["attemptsCount"] = int(attempts_count)

    last_target = data.get("lastTarget")
    if isinstance(last_target, str) and last_target.strip():
        payload["lastTarget"] = last_target.strip()[:200]

    example_mistake = data.get("exampleMistake")
    if isinstance(example_mistake, str) and example_mistake.strip():
        payload["exampleMistake"] = example_mistake.strip()[:200]

    issues = data.get("issues")
    if isinstance(issues, list):
        allowed = {
            "slow_response",
            "wrong_word_flagged",
            "unclear_tip",
            "ui_confusing",
            "noise_issue",
            "mic_issue",
        }
        cleaned = []
        for item in issues:
            if not isinstance(item, str):
                continue
            key = item.strip().lower()
            if key in allowed and key not in cleaned:
                cleaned.append(key)
        if cleaned:
            payload["issues"] = cleaned

    study_tag = data.get("studyTag")
    if isinstance(study_tag, str) and study_tag.strip():
        payload["studyTag"] = study_tag.strip()[:40]

    session_id = data.get("sessionId")
    if isinstance(session_id, str) and session_id.strip():
        payload["sessionId"] = session_id.strip()[:64]

    ref = db.collection("feedback").document()
    ref.set(payload)
    return jsonify({"ok": True, "id": ref.id}), 201

@main_bp.get("/api/attempts/summary")
def attempts_summary():
    db = current_app.db
    if db is None:
        return jsonify({"count": 0, "avgAccuracy": None, "hardestWords": [], "suggestedPhrases": [], "items": []})
    try:
        uid = auth_uid()
    except Exception as e:
        return jsonify({"error": f"unauthorized: {e}"}), 401

    from firebase_admin import firestore
    q = (db.collection("attempts")
         .where("uid", "==", uid)
         .order_by("createdAt", direction=firestore.Query.DESCENDING)
         .limit(50))
    rows = []
    for d in q.stream():
        obj = d.to_dict()
        ca = obj.get("createdAt")
        obj["createdAt"] = ca.isoformat() if hasattr(ca, "isoformat") else None
        rows.append(obj)

    if not rows:
        return jsonify({"count": 0, "avgAccuracy": None, "hardestWords": [], "suggestedPhrases": [], "items": []})

    avg = sum((r.get("accuracy") or 0.0) for r in rows) / len(rows)
    hardest = {}
    for r in rows:
        for w in (r.get("hardWords") or []):
            hardest[w] = hardest.get(w, 0) + 1
    hardest_sorted = sorted(hardest.items(), key=lambda x: x[1], reverse=True)
    return jsonify({
        "count": len(rows),
        "avgAccuracy": round(float(avg), 4),
        "hardestWords": [w for w, _ in hardest_sorted[:10]],
        "suggestedPhrases": [w for w, _ in hardest_sorted[:5]],
        "items": rows,
    })

@main_bp.get("/api/study/summary")
def study_summary():
    db = current_app.db
    if db is None:
        return jsonify({"error": "firestore not configured"}), 500
    try:
        uid = auth_uid()
    except Exception as e:
        return jsonify({"error": f"unauthorized: {e}"}), 401

    tag = (request.args.get("tag") or "").strip()
    if not tag:
        return jsonify({"error": "missing tag"}), 400

    def as_int(val, dv=500):
        try:
            return int(str(val))
        except Exception:
            return dv

    def mean(vals):
        vals = [v for v in vals if isinstance(v, (int, float))]
        return sum(vals) / len(vals) if vals else None

    def to_dt(v):
        if hasattr(v, "timestamp"):
            return v
        try:
            return v.to_datetime()
        except Exception:
            return None

    def to_iso(v):
        if hasattr(v, "isoformat"):
            return v.isoformat()
        try:
            return v.to_datetime().isoformat()
        except Exception:
            return None

    limit = max(1, min(1000, as_int(request.args.get("limit"), 500)))
    tag_norm = tag.lower()

    attempts = []
    q = db.collection("attempts").where("uid", "==", uid).limit(limit)
    for d in q.stream():
        obj = d.to_dict() or {}
        if str(obj.get("studyTag") or "").strip().lower() != tag_norm:
            continue
        attempts.append(obj)

    attempts_sorted = sorted(attempts, key=lambda r: to_dt(r.get("createdAt")) or 0)
    acc_vals = [r.get("accuracy") for r in attempts_sorted if isinstance(r.get("accuracy"), (int, float))]
    wer_vals = [r.get("wer") for r in attempts_sorted if isinstance(r.get("wer"), (int, float))]
    lat_vals = [r.get("latencyMs") for r in attempts_sorted if isinstance(r.get("latencyMs"), (int, float))]
    server_lat_vals = [r.get("serverLatencyMs") for r in attempts_sorted if isinstance(r.get("serverLatencyMs"), (int, float))]

    pass_threshold = 0.8
    pass_count = sum(1 for v in acc_vals if isinstance(v, (int, float)) and v >= pass_threshold)

    # first vs second half
    half = len(attempts_sorted) // 2
    acc_first = acc_second = wer_first = wer_second = acc_delta = wer_delta = None
    if half > 0:
        first = attempts_sorted[:half]
        second = attempts_sorted[-half:]
        acc_first = mean([r.get("accuracy") for r in first])
        acc_second = mean([r.get("accuracy") for r in second])
        wer_first = mean([r.get("wer") for r in first])
        wer_second = mean([r.get("wer") for r in second])
        if acc_first is not None and acc_second is not None:
            acc_delta = acc_second - acc_first
        if wer_first is not None and wer_second is not None:
            wer_delta = wer_second - wer_first

    # error type counts
    status_counts = {}
    for r in attempts_sorted:
        for w in (r.get("words") or []):
            if not isinstance(w, dict):
                continue
            st = w.get("status")
            if not st:
                continue
            status_counts[st] = status_counts.get(st, 0) + 1

    # hard words
    hard_counts = {}
    for r in attempts_sorted:
        for w in (r.get("hardWords") or []):
            if not w:
                continue
            k = str(w).lower()
            hard_counts[k] = hard_counts.get(k, 0) + 1
    hard_top = sorted(hard_counts.items(), key=lambda x: x[1], reverse=True)[:10]

    # feedback summary
    feedback_rows = []
    qf = db.collection("feedback").where("uid", "==", uid).limit(limit)
    for d in qf.stream():
        obj = d.to_dict() or {}
        if str(obj.get("studyTag") or "").strip().lower() != tag_norm:
            continue
        created_at = obj.get("createdAt")
        feedback_rows.append({
            "createdAt": to_iso(created_at),
            "usability": obj.get("usability"),
            "feedback": obj.get("feedback"),
            "speed": obj.get("speed"),
            "satisfaction": obj.get("satisfaction"),
            "personalization": obj.get("personalization"),
            "clarity": obj.get("clarity"),
            "issues": obj.get("issues") or [],
            "comment": (obj.get("comment") or "").strip(),
            "lastTarget": obj.get("lastTarget"),
        })

    def avg_field(key):
        return mean([r.get(key) for r in feedback_rows])

    issues = {}
    for r in feedback_rows:
        for item in (r.get("issues") or []):
            k = str(item)
            issues[k] = issues.get(k, 0) + 1

    feedback_comments = [r.get("comment") for r in feedback_rows if r.get("comment")]

    return jsonify({
        "tag": tag,
        "attemptsCount": len(attempts_sorted),
        "avgAccuracy": round(float(mean(acc_vals)), 4) if mean(acc_vals) is not None else None,
        "avgWer": round(float(mean(wer_vals)), 4) if mean(wer_vals) is not None else None,
        "avgLatencyMs": round(float(mean(lat_vals)), 2) if mean(lat_vals) is not None else None,
        "avgServerLatencyMs": round(float(mean(server_lat_vals)), 2) if mean(server_lat_vals) is not None else None,
        "passThreshold": pass_threshold,
        "passCount": pass_count,
        "accuracyFirstHalf": round(float(acc_first), 4) if acc_first is not None else None,
        "accuracySecondHalf": round(float(acc_second), 4) if acc_second is not None else None,
        "accuracyDelta": round(float(acc_delta), 4) if acc_delta is not None else None,
        "werFirstHalf": round(float(wer_first), 4) if wer_first is not None else None,
        "werSecondHalf": round(float(wer_second), 4) if wer_second is not None else None,
        "werDelta": round(float(wer_delta), 4) if wer_delta is not None else None,
        "errorCounts": status_counts,
        "hardWordsTop": [{"word": w, "count": c} for w, c in hard_top],
        "feedback": {
            "count": len(feedback_rows),
            "usability": avg_field("usability"),
            "feedback": avg_field("feedback"),
            "speed": avg_field("speed"),
            "satisfaction": avg_field("satisfaction"),
            "personalization": avg_field("personalization"),
            "clarity": avg_field("clarity"),
        },
        "feedbackRows": feedback_rows,
        "feedbackComments": feedback_comments,
        "issues": issues,
    })

@main_bp.post("/api/lessons/generate")
def lessons_generate():
    try:
        uid = auth_uid()
    except Exception as e:
        return jsonify({"error": f"unauthorized: {e}"}), 401

    data = request.get_json(silent=True) or {}
    goal = (data.get("goal") or "").strip()
    if not goal:
        return jsonify({"error": "missing goal"}), 400

    def _clean_list(val):
        if not val:
            return []
        if isinstance(val, list):
            return val
        if isinstance(val, str):
            return [x.strip() for x in val.split(",") if x.strip()]
        try:
            return list(val)
        except Exception:
            return []

    params = {
        "goal": goal,
        "topic": (data.get("topic") or "").strip() or "daily conversation",
        "level": (data.get("level") or "b1").strip().lower(),
        "durationMinutes": int(data.get("durationMinutes") or 20),
        "weakWords": _clean_list(data.get("weakWords")),
        "weakPronunciation": _clean_list(data.get("weakPronunciation")),
        "tone": (data.get("tone") or "coaching").strip().lower(),
    }

    try:
        out = generate_lesson_plan(params)
        out["uid"] = uid
        return jsonify(out), 200
    except Exception as e:
        logging.exception("lesson generation failed")
        return jsonify({"error": f"lesson_generation_failed: {e}"}), 500

# ---------- app factory ----------

def create_app():
    load_dotenv(os.path.join(BASE_DIR, ".env"))
    setup_logging()

    app = Flask(__name__)
    app.config["MAX_CONTENT_LENGTH"] = 16 * 1024 * 1024

    with app.app_context():
        app.db = init_firebase()
        app.whisper_model = init_whisper()
        app.accent_detector = AccentDetector()

    CORS(
        app,
        resources={r"/api/*": {"origins": ["http://localhost:3000", "http://127.0.0.1:3000"],
                               "methods": ["GET", "POST", "OPTIONS"],
                               "allow_headers": ["Content-Type", "Authorization"]}}
    )

    app.register_blueprint(main_bp)
    try:
        app.register_blueprint(voice_bp, url_prefix="/api/voice")
    except Exception as e:
        logging.warning(f"voice blueprint not loaded: {e}")

    return app

if __name__ == "__main__":
    app = create_app()
    port = int(os.environ.get("PORT", "5050"))
    app.run(host="0.0.0.0", port=port, debug=True)
