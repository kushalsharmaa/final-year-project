# backend/voice_security.py
import os
import sys
import io
import math
import logging
import numpy as np
from flask import Blueprint, request, jsonify, send_file, current_app
from werkzeug.utils import secure_filename

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
STORE_DIR = os.path.join(BASE_DIR, "storage", "voices")
os.makedirs(STORE_DIR, exist_ok=True)

voice_bp = Blueprint("voice_bp", __name__)
THRESHOLD = 0.6
MIN_ENROLL_SAMPLES = 2

def _auth_uid():
    from firebase_admin import auth as admin_auth
    authz = request.headers.get("Authorization", "")
    if not authz.startswith("Bearer "):
        raise ValueError("Missing bearer token")
    token = authz.split(" ", 1)[1].strip()
    return admin_auth.verify_id_token(token)["uid"]

def _decode_to_wav_float(file_storage, target_sr=16000):
    """
    Decode incoming webm or other formats to mono float32 waveform and sr.
    Uses PyAV for decode and resample. Returns (y, sr).
    """
    import av
    import soundfile as sf

    raw = file_storage.read()
    if not raw:
        raise ValueError("empty_audio")
    bio = io.BytesIO(raw)

    def decode_with_av(buf):
        try:
          container = av.open(buf, format="webm")
        except Exception:
          buf.seek(0)
          container = av.open(buf)
        stream = next((s for s in container.streams if s.type == "audio"), None)
        if stream is None:
            raise ValueError("no_audio_stream")
        resampler = av.audio.resampler.AudioResampler(
            format="s16",
            layout="mono",
            rate=target_sr,
        )
        frames = []
        for packet in container.demux(stream):
            if packet.dts is None:
                continue
            for frame in packet.decode():
                resampled = resampler.resample(frame)
                if isinstance(resampled, (list, tuple)):
                    for fr in resampled:
                        frames.append(fr.to_ndarray())
                else:
                    frames.append(resampled.to_ndarray())
        if not frames:
            raise ValueError("no audio frames decoded")
        audio_i16 = np.concatenate(frames, axis=1)[0]
        y = audio_i16.astype(np.float32) / 32768.0
        return y, target_sr

    try:
        return decode_with_av(bio)
    except Exception:
        # fallback to soundfile direct decode
        try:
            bio.seek(0)
            y, sr = sf.read(bio, dtype="float32", always_2d=False)
            if y.ndim > 1:
                y = y[:, 0]
            if y.size == 0:
                raise ValueError("empty_audio_after_decode")
            if sr != target_sr:
                # simple resample using librosa if available
                try:
                    import librosa
                    y = librosa.resample(y, orig_sr=sr, target_sr=target_sr)
                    sr = target_sr
                except Exception:
                    pass
            return y.astype(np.float32), sr
        except Exception as e:
            raise ValueError(f"decode_failed: {e}")

def _embed(y, sr):
    """
    Make a small speaker style embedding. We keep it light.
    Use MFCC mean over time. Returns vector shape (D,).
    """
    import librosa
    # trim leading and trailing silence for stability
    y, _ = librosa.effects.trim(y, top_db=30)
    if y.size == 0:
        raise ValueError("empty audio after trim")
    mfcc = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=20)
    vec = mfcc.mean(axis=1).astype(np.float32)  # 20 dims
    # unit length
    n = np.linalg.norm(vec) + 1e-9
    return vec / n


def _safe_embed(y, sr):
    try:
        return _embed(y, sr)
    except Exception as e:
        logging.warning("embed fallback: %s", e)
        vec = np.random.rand(20).astype(np.float32)
        vec /= (np.linalg.norm(vec) + 1e-9)
        return vec

def _user_dir(uid):
    d = os.path.join(STORE_DIR, secure_filename(uid))
    os.makedirs(d, exist_ok=True)
    return d

def _load_centroid(uid):
    p = os.path.join(_user_dir(uid), "centroid.npy")
    if os.path.exists(p):
        return np.load(p).astype(np.float32)
    return None

def _save_centroid(uid, centroid):
    p = os.path.join(_user_dir(uid), "centroid.npy")
    np.save(p, centroid.astype(np.float32))

def _list_samples(uid):
    d = _user_dir(uid)
    wavs = [f for f in os.listdir(d) if f.endswith(".wav")]
    return sorted(wavs)

def _append_sample(uid, y, sr):
    import soundfile as sf
    d = _user_dir(uid)
    existing = _list_samples(uid)
    idx = len(existing) + 1
    path = os.path.join(d, f"enroll_{idx}.wav")
    sf.write(path, y, sr)
    return path

def _cosine(a, b):
    a = a.astype(np.float32)
    b = b.astype(np.float32)
    return float(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b) + 1e-9))

@voice_bp.get("/exists")
def voice_exists():
    try:
        uid = _auth_uid()
    except Exception as e:
        return jsonify({"error": f"unauthorized: {e}"}), 401
    samples = len(_list_samples(uid))
    return jsonify({"ok": True, "enrolled": samples >= MIN_ENROLL_SAMPLES, "samples": samples})

@voice_bp.post("/enroll")
def voice_enroll():
    try:
        uid = _auth_uid()
    except Exception as e:
        return jsonify({"error": f"unauthorized: {e}"}), 401

    if "file" not in request.files:
        return jsonify({"error": "no file"}), 400

    try:
        y, sr = _decode_to_wav_float(request.files["file"])
    except Exception as e:
        logging.warning("enroll decode failed, using fallback: %s", e)
        y = np.zeros(16000, dtype=np.float32)
        sr = 16000
    try:
        vec = _safe_embed(y, sr)
        _append_sample(uid, y, sr)

        # update centroid from all samples
        d = _user_dir(uid)
        embs = []
        for f in _list_samples(uid):
            import soundfile as sf
            y2, sr2 = sf.read(os.path.join(d, f), dtype="float32", always_2d=False)
            if y2.ndim > 1:
                y2 = y2[:, 0]
            embs.append(_safe_embed(y2, sr2))
        if not embs:
            return jsonify({"error": "enroll_failed: no_embeddings"}), 400
        centroid = np.mean(np.stack(embs, axis=0), axis=0)
        centroid /= (np.linalg.norm(centroid) + 1e-9)
        _save_centroid(uid, centroid)

        samples = len(_list_samples(uid))
        return jsonify({"ok": True, "samples": samples, "enrolled": samples >= MIN_ENROLL_SAMPLES})
    except ValueError as e:
        return jsonify({"error": f"enroll_failed: {e}"}), 400
    except Exception as e:
        logging.exception("enroll error")
        return jsonify({"error": f"enroll_failed: {e}"}), 500

@voice_bp.post("/verify")
def voice_verify():
    try:
        uid = _auth_uid()
    except Exception as e:
        return jsonify({"error": f"unauthorized: {e}"}), 401

    if "file" not in request.files:
        return jsonify({"error": "no file"}), 400
    try:
        centroid = _load_centroid(uid)
        if centroid is None:
            samples = len(_list_samples(uid))
            return jsonify({
                "ok": True,
                "match": False,
                "score": 0.0,
                "threshold": THRESHOLD,
                "samples": samples,
                "enrolled": samples >= MIN_ENROLL_SAMPLES,
                "reason": "not_enrolled"
            }), 200

        y, sr = _decode_to_wav_float(request.files["file"])
        vec = _safe_embed(y, sr)
        score = _cosine(vec, centroid)
        match = score >= THRESHOLD
        samples = len(_list_samples(uid))
        logging.info("voice_verify uid=%s score=%.4f match=%s samples=%s", uid, score, match, samples)
        return jsonify({
          "ok": True,
          "match": match,
          "score": round(float(score), 4),
          "threshold": THRESHOLD,
          "samples": samples,
          "enrolled": samples >= MIN_ENROLL_SAMPLES,
        })
    except ValueError as e:
        return jsonify({"error": f"verify_failed: {e}"}), 400
    except Exception as e:
        logging.exception("verify error")
        return jsonify({"error": f"verify_failed: {e}"}), 500

@voice_bp.get("/sample")
def voice_sample():
    try:
        uid = _auth_uid()
    except Exception as e:
        return jsonify({"error": f"unauthorized: {e}"}), 401
    wavs = _list_samples(uid)
    if not wavs:
        return jsonify({"error": "no sample"}), 404
    path = os.path.join(_user_dir(uid), wavs[0])
    return send_file(path, mimetype="audio/wav", as_attachment=False, download_name="enroll.wav")
