# backend/accent.py
"""
Optional accent detection helper.
- Default mode is "off" to avoid heavy downloads unless configured.
- Set ACCENT_DETECTOR=mock to return a deterministic demo label.
- Set ACCENT_DETECTOR=auto (and install speechbrain + model) to attempt real inference.
- Set ACCENT_LABEL to force a label (useful for testing), ACCENT_CONFIDENCE to override confidence.
"""

import logging
import os
from typing import Optional, Tuple
import tempfile
import shutil
import numpy as np

try:
    import torchaudio  # type: ignore
except Exception:
    torchaudio = None
try:
    import av  # type: ignore
except Exception:
    av = None


class AccentDetector:
    def __init__(self):
        self.mode = (os.environ.get("ACCENT_DETECTOR") or "off").strip().lower()
        self.force_label = (os.environ.get("ACCENT_LABEL") or "").strip() or None
        self.force_conf = float(os.environ.get("ACCENT_CONFIDENCE", "0.92"))
        self.model = None
        self.model_source = None

        if self.mode == "auto":
            self._init_speechbrain()

    def _init_speechbrain(self):
        try:
            from speechbrain.pretrained import EncoderClassifier  # type: ignore

            source = os.environ.get("ACCENT_MODEL_SOURCE", "speechbrain/lang-id-voxlingua107")
            self.model = EncoderClassifier.from_hparams(source=source, run_opts={"device": "cpu"})
            self.model_source = source
            self.mode = "speechbrain"
            logging.info("accent detector loaded: %s", source)
        except Exception as e:
            logging.warning("accent detector not loaded: %s", e)
            self.model = None
            self.model_source = None
            self.mode = "off"

    def detect(self, audio_path: str, lang: str = "en") -> Tuple[Optional[str], Optional[float]]:
        """Return (label, confidence) or (None, None) when unavailable."""
        if self.force_label:
            return self.force_label, self.force_conf

        if self.mode in ("off", "", None):
            return None, None

        if self.mode == "mock":
            lbl = f"{(lang or 'en').lower()}-demo"
            return lbl, 0.42

        if self.mode == "speechbrain" and self.model:
            tmp_dir = None
            in_path = audio_path
            if not audio_path.lower().endswith(".wav"):
                in_path, tmp_dir = self._to_wav(audio_path)
            try:
                import torch

                with torch.no_grad():
                    score, idx, label = self.model.classify_file(in_path)
                conf = float(score[0][idx])
                lbl = str(label[0])
                if tmp_dir:
                    shutil.rmtree(tmp_dir, ignore_errors=True)
                return lbl, conf
            except Exception as e:
                logging.warning("accent detection failed: %s", e)
                if tmp_dir:
                    shutil.rmtree(tmp_dir, ignore_errors=True)
                return None, None

        return None, None

    def _to_wav(self, path: str) -> Tuple[str, Optional[str]]:
        """Convert arbitrary audio file to wav (mono) for the classifier."""
        tmp_dir = tempfile.mkdtemp(prefix="accent_")
        out_path = os.path.join(tmp_dir, "input.wav")

        # try torchaudio direct load
        if torchaudio is not None:
            try:
                wav, sr = torchaudio.load(path)
                torchaudio.save(out_path, wav, sr)
                return out_path, tmp_dir
            except Exception as e:
                logging.warning("accent torchaudio load failed: %s", e)

        # try PyAV resample to 16k mono
        if av is not None:
            try:
                container = av.open(path)
                stream = next((s for s in container.streams if s.type == "audio"), None)
                if stream is None:
                    raise ValueError("no audio stream")
                resampler = av.audio.resampler.AudioResampler(format="s16", layout="mono", rate=16000)
                frames = []
                for packet in container.demux(stream):
                    if packet.dts is None:
                        continue
                    for frame in packet.decode():
                        res = resampler.resample(frame)
                        if isinstance(res, (list, tuple)):
                            for fr in res:
                                frames.append(fr.to_ndarray())
                        else:
                            frames.append(res.to_ndarray())
                if not frames:
                    raise ValueError("no frames decoded")
                audio_i16 = np.concatenate(frames, axis=1)[0]
                # convert to float tensor for torchaudio.save
                if torchaudio is not None:
                    import torch

                    wav = torch.from_numpy(audio_i16).float().unsqueeze(0) / 32768.0
                    torchaudio.save(out_path, wav, 16000)
                    return out_path, tmp_dir
            except Exception as e:
                logging.warning("accent av decode failed: %s", e)

        shutil.rmtree(tmp_dir, ignore_errors=True)
        return path, None
