#!/usr/bin/env python3
import argparse
import json
import os
import statistics
from collections import Counter
from datetime import datetime


def mean(vals):
    vals = [v for v in vals if isinstance(v, (int, float))]
    return statistics.mean(vals) if vals else None


def norm_tag(val):
    return str(val or "").strip().lower()


def load_json(path):
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)

def parse_dt(s):
    if not s:
        return None
    try:
        return datetime.fromisoformat(s)
    except Exception:
        return None


def bar_chart_svg(title, labels, values, y_label, out_path, value_fmt="{:.2f}"):
    width, height = 900, 500
    margin = {"l": 70, "r": 30, "t": 50, "b": 90}
    chart_w = width - margin["l"] - margin["r"]
    chart_h = height - margin["t"] - margin["b"]

    max_val = max(values) if values else 1.0
    if max_val <= 0:
        max_val = 1.0
    y_max = max_val * 1.1

    bar_gap = 14
    bar_w = max(10, (chart_w - bar_gap * (len(labels) - 1)) / max(1, len(labels)))

    def y_scale(val):
        return margin["t"] + chart_h - (val / y_max) * chart_h

    def x_pos(i):
        return margin["l"] + i * (bar_w + bar_gap)

    lines = []
    lines.append(f"<svg xmlns='http://www.w3.org/2000/svg' width='{width}' height='{height}'>")
    lines.append("<rect width='100%' height='100%' fill='white'/>")
    lines.append(f"<text x='{width/2}' y='28' text-anchor='middle' "
                 "font-family='Arial' font-size='18' fill='#111'>{}</text>".format(title))

    # Axis
    x0 = margin["l"]
    y0 = margin["t"] + chart_h
    lines.append(f"<line x1='{x0}' y1='{margin['t']}' x2='{x0}' y2='{y0}' stroke='#222'/>")
    lines.append(f"<line x1='{x0}' y1='{y0}' x2='{width - margin['r']}' y2='{y0}' stroke='#222'/>")

    # Y label
    lines.append(
        f"<text x='14' y='{margin['t'] + chart_h/2}' transform='rotate(-90 14 {margin['t'] + chart_h/2})' "
        "font-family='Arial' font-size='12' fill='#333'>{}</text>".format(y_label)
    )

    # Grid + ticks
    for i in range(6):
        v = y_max * i / 5
        y = y_scale(v)
        lines.append(f"<line x1='{x0}' y1='{y}' x2='{width - margin['r']}' y2='{y}' stroke='#eee'/>")
        lines.append(f"<text x='{x0 - 8}' y='{y + 4}' text-anchor='end' "
                     "font-family='Arial' font-size='11' fill='#444'>{}</text>".format(value_fmt.format(v)))

    # Bars
    for i, (label, val) in enumerate(zip(labels, values)):
        x = x_pos(i)
        y = y_scale(val)
        h = y0 - y
        lines.append(f"<rect x='{x}' y='{y}' width='{bar_w}' height='{h}' fill='#4f46e5'/>")
        lines.append(f"<text x='{x + bar_w/2}' y='{y - 6}' text-anchor='middle' "
                     "font-family='Arial' font-size='11' fill='#111'>{}</text>".format(value_fmt.format(val)))
        lines.append(f"<text x='{x + bar_w/2}' y='{y0 + 18}' text-anchor='middle' "
                     "font-family='Arial' font-size='11' fill='#333'>{}</text>".format(label))

    lines.append("</svg>")

    with open(out_path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))

def grouped_bar_svg(title, groups, series, y_label, out_path, value_fmt="{:.2f}", y_min=0.0, y_max=1.0):
    width, height = 1000, 520
    margin = {"l": 70, "r": 30, "t": 50, "b": 90}
    chart_w = width - margin["l"] - margin["r"]
    chart_h = height - margin["t"] - margin["b"]

    if not groups or not series:
        return

    colors = ["#2563eb", "#0f766e", "#f59e0b", "#9333ea"]

    def y_scale(val):
        return margin["t"] + chart_h - ((val - y_min) / (y_max - y_min)) * chart_h

    lines = []
    lines.append(f"<svg xmlns='http://www.w3.org/2000/svg' width='{width}' height='{height}'>")
    lines.append("<rect width='100%' height='100%' fill='white'/>")
    lines.append(f"<text x='{width/2}' y='28' text-anchor='middle' "
                 "font-family='Arial' font-size='18' fill='#111'>{}</text>".format(title))

    x0 = margin["l"]
    y0 = margin["t"] + chart_h
    lines.append(f"<line x1='{x0}' y1='{margin['t']}' x2='{x0}' y2='{y0}' stroke='#222'/>")
    lines.append(f"<line x1='{x0}' y1='{y0}' x2='{width - margin['r']}' y2='{y0}' stroke='#222'/>")

    lines.append(
        f"<text x='14' y='{margin['t'] + chart_h/2}' transform='rotate(-90 14 {margin['t'] + chart_h/2})' "
        "font-family='Arial' font-size='12' fill='#333'>{}</text>".format(y_label)
    )

    for i in range(6):
        v = y_min + (y_max - y_min) * i / 5
        y = y_scale(v)
        lines.append(f"<line x1='{x0}' y1='{y}' x2='{width - margin['r']}' y2='{y}' stroke='#eee'/>")
        lines.append(f"<text x='{x0 - 8}' y='{y + 4}' text-anchor='end' "
                     "font-family='Arial' font-size='11' fill='#444'>{}</text>".format(value_fmt.format(v)))

    group_gap = 20
    bar_gap = 6
    group_w = (chart_w - group_gap * (len(groups) - 1)) / len(groups)
    bar_w = (group_w - bar_gap * (len(series) - 1)) / len(series)

    for gi, group in enumerate(groups):
        gx = x0 + gi * (group_w + group_gap)
        for si, s in enumerate(series):
            val = s["values"][gi]
            x = gx + si * (bar_w + bar_gap)
            y = y_scale(val)
            h = y0 - y
            lines.append(f"<rect x='{x}' y='{y}' width='{bar_w}' height='{h}' fill='{colors[si % len(colors)]}'/>")
            lines.append(f"<text x='{x + bar_w/2}' y='{y - 6}' text-anchor='middle' "
                         f"font-family='Arial' font-size='10' fill='#111'>{value_fmt.format(val)}</text>")

        lines.append(f"<text x='{gx + group_w/2}' y='{y0 + 18}' text-anchor='middle' "
                     "font-family='Arial' font-size='11' fill='#333'>{}</text>".format(group))

    # legend
    lx = width - margin["r"] - 220
    ly = margin["t"] - 12
    for i, s in enumerate(series):
        lines.append(f"<rect x='{lx}' y='{ly + i * 16}' width='10' height='10' fill='{colors[i % len(colors)]}'/>")
        lines.append(f"<text x='{lx + 16}' y='{ly + i * 16 + 9}' font-family='Arial' font-size='11' fill='#333'>{s['label']}</text>")

    lines.append("</svg>")

    with open(out_path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))

def line_chart_svg(title, values, y_label, out_path, value_fmt="{:.2f}", y_min=None, y_max=None):
    width, height = 900, 500
    margin = {"l": 70, "r": 30, "t": 50, "b": 70}
    chart_w = width - margin["l"] - margin["r"]
    chart_h = height - margin["t"] - margin["b"]

    if not values:
        return

    vmin = min(values) if y_min is None else y_min
    vmax = max(values) if y_max is None else y_max
    if vmin == vmax:
        vmax = vmin + 1.0

    def y_scale(val):
        return margin["t"] + chart_h - ((val - vmin) / (vmax - vmin)) * chart_h

    def x_scale(idx):
        if len(values) == 1:
            return margin["l"] + chart_w / 2
        return margin["l"] + (idx / (len(values) - 1)) * chart_w

    lines = []
    lines.append(f"<svg xmlns='http://www.w3.org/2000/svg' width='{width}' height='{height}'>")
    lines.append("<rect width='100%' height='100%' fill='white'/>")
    lines.append(f"<text x='{width/2}' y='28' text-anchor='middle' "
                 "font-family='Arial' font-size='18' fill='#111'>{}</text>".format(title))

    # Axis
    x0 = margin["l"]
    y0 = margin["t"] + chart_h
    lines.append(f"<line x1='{x0}' y1='{margin['t']}' x2='{x0}' y2='{y0}' stroke='#222'/>")
    lines.append(f"<line x1='{x0}' y1='{y0}' x2='{width - margin['r']}' y2='{y0}' stroke='#222'/>")

    # Y label
    lines.append(
        f"<text x='14' y='{margin['t'] + chart_h/2}' transform='rotate(-90 14 {margin['t'] + chart_h/2})' "
        "font-family='Arial' font-size='12' fill='#333'>{}</text>".format(y_label)
    )

    # Grid + ticks
    for i in range(6):
        v = vmin + (vmax - vmin) * i / 5
        y = y_scale(v)
        lines.append(f"<line x1='{x0}' y1='{y}' x2='{width - margin['r']}' y2='{y}' stroke='#eee'/>")
        lines.append(f"<text x='{x0 - 8}' y='{y + 4}' text-anchor='end' "
                     "font-family='Arial' font-size='11' fill='#444'>{}</text>".format(value_fmt.format(v)))

    # Line
    points = " ".join(f"{x_scale(i):.2f},{y_scale(v):.2f}" for i, v in enumerate(values))
    lines.append(f"<polyline fill='none' stroke='#4f46e5' stroke-width='2' points='{points}'/>")

    # Points
    for i, v in enumerate(values):
        x = x_scale(i)
        y = y_scale(v)
        lines.append(f"<circle cx='{x:.2f}' cy='{y:.2f}' r='3' fill='#4f46e5'/>")

    # X labels (attempt index)
    step = max(1, len(values) // 10)
    for i in range(0, len(values), step):
        x = x_scale(i)
        lines.append(f"<text x='{x:.2f}' y='{y0 + 18}' text-anchor='middle' "
                     "font-family='Arial' font-size='10' fill='#333'>{}</text>".format(i + 1))

    lines.append("</svg>")

    with open(out_path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))


def main():
    parser = argparse.ArgumentParser(description="Generate Chapter 6 graphs from exported data.")
    parser.add_argument("--attempts", default="data/attempts_export.json")
    parser.add_argument("--feedback", default="data/feedback_export.json")
    parser.add_argument("--out-dir", default="figures/chapter6")
    parser.add_argument("--tags", default="", help="Comma-separated study tags to include (optional)")
    args = parser.parse_args()

    attempts = load_json(args.attempts)
    feedback = load_json(args.feedback)

    tags_filter = [t.strip().lower() for t in args.tags.split(",") if t.strip()] if args.tags else []

    # Group attempts by tag
    attempts_by_tag = {}
    for a in attempts:
        tag = norm_tag(a.get("studyTag"))
        if not tag:
            continue
        if tags_filter and tag not in tags_filter:
            continue
        attempts_by_tag.setdefault(tag, []).append(a)

    feedback_by_tag = {}
    for f in feedback:
        tag = norm_tag(f.get("studyTag"))
        if not tag:
            continue
        if tags_filter and tag not in tags_filter:
            continue
        feedback_by_tag.setdefault(tag, []).append(f)

    tags = tags_filter if tags_filter else sorted(attempts_by_tag.keys())
    tags = [t for t in tags if t in attempts_by_tag]

    os.makedirs(args.out_dir, exist_ok=True)

    # WER chart
    wer_vals = [mean([a.get("wer") for a in attempts_by_tag[t]]) or 0 for t in tags]
    if wer_vals:
        bar_chart_svg(
            "Average WER by Participant",
            tags,
            wer_vals,
            "WER",
            os.path.join(args.out_dir, "wer_by_participant.svg"),
            value_fmt="{:.2f}",
        )

    # Latency chart (client)
    lat_vals = [mean([a.get("latencyMs") for a in attempts_by_tag[t]]) or 0 for t in tags]
    if lat_vals:
        bar_chart_svg(
            "Average Client Latency by Participant (ms)",
            tags,
            lat_vals,
            "Latency (ms)",
            os.path.join(args.out_dir, "latency_by_participant.svg"),
            value_fmt="{:.0f}",
        )

    # Feedback avg chart
    fb_tags = [t for t in tags if t in feedback_by_tag]
    fb_vals = []
    for t in fb_tags:
        fb = feedback_by_tag.get(t, [])
        ratings = []
        for key in ("usability", "feedback", "speed", "satisfaction"):
            ratings.extend([f.get(key) for f in fb if isinstance(f.get(key), (int, float))])
        fb_vals.append(mean(ratings) or 0)
    if fb_vals:
        bar_chart_svg(
            "Average Feedback Rating by Participant",
            fb_tags,
            fb_vals,
            "Rating (1-5)",
            os.path.join(args.out_dir, "feedback_by_participant.svg"),
            value_fmt="{:.2f}",
        )

    # Accuracy and WER over attempts (per participant)
    for tag in tags:
        rows = sorted(attempts_by_tag[tag], key=lambda r: parse_dt(r.get("createdAt")) or datetime.min)
        acc_vals = [r.get("accuracy") for r in rows if isinstance(r.get("accuracy"), (int, float))]
        wer_vals = [r.get("wer") for r in rows if isinstance(r.get("wer"), (int, float))]
        if acc_vals:
            line_chart_svg(
                f"Accuracy Over Attempts ({tag})",
                acc_vals,
                "Accuracy",
                os.path.join(args.out_dir, f"accuracy_over_attempts_{tag}.svg"),
                value_fmt="{:.2f}",
                y_min=0.0,
                y_max=1.0,
            )
        if wer_vals:
            line_chart_svg(
                f"WER Over Attempts ({tag})",
                wer_vals,
                "WER",
                os.path.join(args.out_dir, f"wer_over_attempts_{tag}.svg"),
                value_fmt="{:.2f}",
            )

    # Error type distribution (overall)
    status_counts = Counter()
    for tag in tags:
        for a in attempts_by_tag[tag]:
            for w in a.get("words") or []:
                if isinstance(w, dict):
                    st = w.get("status")
                    if st:
                        status_counts[st] += 1
    if status_counts:
        labels = list(status_counts.keys())
        values = [status_counts[k] for k in labels]
        bar_chart_svg(
            "Error Type Counts (All Participants)",
            labels,
            values,
            "Count",
            os.path.join(args.out_dir, "error_type_counts.svg"),
            value_fmt="{:.0f}",
        )

    # Top hard words (overall)
    hard_counts = Counter()
    for tag in tags:
        for a in attempts_by_tag[tag]:
            for w in a.get("hardWords") or []:
                if w:
                    hard_counts[str(w).lower()] += 1
    if hard_counts:
        top = hard_counts.most_common(8)
        labels = [w for w, _ in top]
        values = [c for _, c in top]
        bar_chart_svg(
            "Most Mispronounced Words (All Participants)",
            labels,
            values,
            "Count",
            os.path.join(args.out_dir, "hard_words_top.svg"),
            value_fmt="{:.0f}",
        )

    # First half vs second half accuracy (per participant)
    deltas = []
    for tag in tags:
        rows = sorted(attempts_by_tag[tag], key=lambda r: parse_dt(r.get("createdAt")) or datetime.min)
        half = len(rows) // 2
        if half == 0:
            continue
        first = rows[:half]
        second = rows[-half:]
        acc_first = mean([r.get("accuracy") for r in first])
        acc_second = mean([r.get("accuracy") for r in second])
        if acc_first is None or acc_second is None:
            continue
        deltas.append((tag, acc_second - acc_first))
    if deltas:
        labels = [t for t, _ in deltas]
        values = [v for _, v in deltas]
        bar_chart_svg(
            "Accuracy Improvement (Second Half - First Half)",
            labels,
            values,
            "Accuracy Delta",
            os.path.join(args.out_dir, "accuracy_improvement.svg"),
            value_fmt="{:.2f}",
        )

    # Feedback issues counts (if any)
    issues = Counter()
    for tag in tags:
        for f in feedback_by_tag.get(tag, []):
            for item in f.get("issues") or []:
                if item:
                    issues[str(item)] += 1
    if issues:
        labels = list(issues.keys())
        values = [issues[k] for k in labels]
        bar_chart_svg(
            "Feedback Issues (All Participants)",
            labels,
            values,
            "Count",
            os.path.join(args.out_dir, "feedback_issues.svg"),
            value_fmt="{:.0f}",
        )

    # First half vs second half (accuracy and WER)
    acc_first = []
    acc_second = []
    wer_first = []
    wer_second = []
    for tag in tags:
        rows = sorted(attempts_by_tag[tag], key=lambda r: parse_dt(r.get("createdAt")) or datetime.min)
        half = len(rows) // 2
        if half == 0:
            continue
        first = rows[:half]
        second = rows[-half:]
        acc_first.append(mean([r.get("accuracy") for r in first]) or 0)
        acc_second.append(mean([r.get("accuracy") for r in second]) or 0)
        wer_first.append(mean([r.get("wer") for r in first]) or 0)
        wer_second.append(mean([r.get("wer") for r in second]) or 0)

    if acc_first and acc_second:
        grouped_bar_svg(
            "Accuracy: First Half vs Second Half",
            tags,
            [
                {"label": "first half", "values": acc_first},
                {"label": "second half", "values": acc_second},
            ],
            "Accuracy (0-1)",
            os.path.join(args.out_dir, "accuracy_first_vs_second.svg"),
            value_fmt="{:.2f}",
            y_min=0.0,
            y_max=1.0,
        )

    if wer_first and wer_second:
        grouped_bar_svg(
            "WER: First Half vs Second Half",
            tags,
            [
                {"label": "first half", "values": wer_first},
                {"label": "second half", "values": wer_second},
            ],
            "WER (0-1)",
            os.path.join(args.out_dir, "wer_first_vs_second.svg"),
            value_fmt="{:.2f}",
            y_min=0.0,
            y_max=max(1.0, max(wer_first + wer_second) * 1.1),
        )


if __name__ == "__main__":
    main()
