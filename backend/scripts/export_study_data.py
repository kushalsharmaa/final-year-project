#!/usr/bin/env python3
import argparse
import csv
import json
import os
from datetime import datetime, timezone

import firebase_admin
from firebase_admin import credentials, firestore


def parse_dt(val: str):
    if not val:
        return None
    try:
        dt = datetime.fromisoformat(val)
    except ValueError:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt


def init_db(service_account: str):
    if not os.path.exists(service_account):
        raise SystemExit(f"service account not found: {service_account}")
    if not firebase_admin._apps:
        cred = credentials.Certificate(service_account)
        firebase_admin.initialize_app(cred)
    return firestore.client()


def to_iso(val):
    if hasattr(val, "isoformat"):
        return val.isoformat()
    try:
        return val.to_datetime().isoformat()
    except Exception:
        return val


def fetch_collection(db, name, study_tag=None, start_dt=None, end_dt=None):
    q = db.collection(name)
    if study_tag:
        q = q.where("studyTag", "==", study_tag)
    if start_dt:
        q = q.where("createdAt", ">=", start_dt)
    if end_dt:
        q = q.where("createdAt", "<=", end_dt)
    rows = []
    for doc in q.stream():
        obj = doc.to_dict() or {}
        obj["_id"] = doc.id
        if "createdAt" in obj:
            obj["createdAt"] = to_iso(obj.get("createdAt"))
        rows.append(obj)
    return rows


def write_json(path, rows):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(rows, f, ensure_ascii=True, default=str)


def write_csv(path, rows):
    if not rows:
        with open(path, "w", newline="", encoding="utf-8") as f:
            f.write("")
        return
    keys = set()
    for r in rows:
        keys.update(r.keys())
    fieldnames = sorted(keys)
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames)
        w.writeheader()
        for r in rows:
            row = {}
            for k in fieldnames:
                v = r.get(k)
                if isinstance(v, (list, dict)):
                    row[k] = json.dumps(v, ensure_ascii=True, default=str)
                else:
                    row[k] = v
            w.writerow(row)


def main():
    parser = argparse.ArgumentParser(description="Export Firestore study data.")
    parser.add_argument("--out-dir", default="data", help="Output directory")
    parser.add_argument("--study-tag", default="", help="Filter by studyTag")
    parser.add_argument("--start", default="", help="Start date/time ISO (e.g. 2024-12-01)")
    parser.add_argument("--end", default="", help="End date/time ISO (e.g. 2024-12-31)")
    parser.add_argument("--service-account", default="", help="Path to service account JSON")
    args = parser.parse_args()

    base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    sa = args.service_account or os.environ.get("GOOGLE_APPLICATION_CREDENTIALS") or os.path.join(base_dir, "firebase-service-account.json")
    start_dt = parse_dt(args.start)
    end_dt = parse_dt(args.end)

    db = init_db(sa)
    os.makedirs(args.out_dir, exist_ok=True)

    attempts = fetch_collection(db, "attempts", args.study_tag or None, start_dt, end_dt)
    feedback = fetch_collection(db, "feedback", args.study_tag or None, start_dt, end_dt)

    attempts_json = os.path.join(args.out_dir, "attempts_export.json")
    attempts_csv = os.path.join(args.out_dir, "attempts_export.csv")
    feedback_json = os.path.join(args.out_dir, "feedback_export.json")
    feedback_csv = os.path.join(args.out_dir, "feedback_export.csv")

    write_json(attempts_json, attempts)
    write_csv(attempts_csv, attempts)
    write_json(feedback_json, feedback)
    write_csv(feedback_csv, feedback)

    summary = {
        "attempts": len(attempts),
        "feedback": len(feedback),
        "studyTag": args.study_tag or None,
        "start": args.start or None,
        "end": args.end or None,
    }
    summary_path = os.path.join(args.out_dir, "export_summary.json")
    write_json(summary_path, summary)

    print("exported", summary)


if __name__ == "__main__":
    main()
