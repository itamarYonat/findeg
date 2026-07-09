"""Fetch prerequisite ("מקצועות קדם") and co-requisite/adjoining ("מקצועות
צמודים") relationships for our tracked FinDeg courses, from the same hosted
CheeseFork / technion-sap-info-fetcher data used by fetch_course_semesters.py
(https://github.com/michael-maltsev/technion-sap-info-fetcher, hosted at
michael-maltsev.github.io, refreshed automatically). No login, no direct SAP
OData calls - this data is already the fully-parsed per-course output.

For each tracked course id, uses its record from the most recent checked
semester it actually appears in (any semester, not just ones with a real
scheduled group - prereqs are a course property, not a per-offering one).
"מקצועות קדם" is a free-text string like "(00140104 ו-00140008) או (...)" -
we don't parse the AND/OR/bracket logic, just extract the referenced course
ids (enough to draw a "these are prerequisites of this course" arrow).

Usage:
    python tools/fetch_prereqs.py

Output: js/prereqs.js.
"""
import json
import re
import sys
from pathlib import Path

import requests

sys.stdout.reconfigure(encoding="utf-8")

# Same semesters fetch_course_semesters.py checks, most recent first (prereqs
# are a course property so any semester's record is fine - prefer the newest).
SEMESTERS = ["2026-200", "2025-202", "2025-201", "2025-200"]
DATA_BASE_URL = "https://michael-maltsev.github.io/technion-sap-info-fetcher/"


def fetch_semester_courses(key: str):
    year, sem = key.split("-")
    url = f"{DATA_BASE_URL}courses_{year}_{sem}.json"
    response = requests.get(url, timeout=60)
    response.raise_for_status()
    return response.json()


def main():
    tools_dir = Path(__file__).parent
    data_js = (tools_dir.parent / "js" / "data.js").read_text(encoding="utf-8")
    tracked_ids = set(re.findall(r'"(\d{8})":\s*"', data_js))
    print(f"Tracking {len(tracked_ids)} course ids")

    # course id -> general dict, filled in from the most recent semester first
    # (so more recent data wins if a course appears in multiple semesters).
    by_id = {}
    for key in reversed(SEMESTERS):
        print(f"Fetching {key}...")
        courses = fetch_semester_courses(key)
        for c in courses:
            cid = c.get("general", {}).get("מספר מקצוע")
            if cid in tracked_ids:
                by_id[cid] = c["general"]

    print(f"Found records for {len(by_id)}/{len(tracked_ids)} tracked courses")
    missing = tracked_ids - by_id.keys()
    if missing:
        print(f"No record in any checked semester ({len(missing)}): {', '.join(sorted(missing))}")

    results = {}
    for cid, general in by_id.items():
        prereq_text = general.get("מקצועות קדם", "")
        prereq_ids = sorted((set(re.findall(r"\d{8}", prereq_text)) - {cid}) & tracked_ids)

        adjoining_text = general.get("מקצועות צמודים", "")
        adjoining_ids = sorted((set(adjoining_text.split()) - {cid}) & tracked_ids)

        if prereq_ids or adjoining_ids:
            entry = {}
            if prereq_ids:
                entry["prereq"] = prereq_ids
            if adjoining_ids:
                entry["adjoining"] = adjoining_ids
            results[cid] = entry

    out_path = tools_dir / "prereqs.json"
    out_path.write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\nWrote {out_path} ({len(results)} courses with edges)")

    js_lines = [
        "/* FinDeg – מקצועות קדם וצמודים בין מקצועות שאנו עוקבים אחריהם, לפי נתוני",
        " * technion-sap-info-fetcher המתארחים ב-GitHub Pages (אותו מקור כמו",
        " * js/semesters.js). קובץ זה מיוצר אוטומטית ע\"י tools/fetch_prereqs.py -",
        " * אין לערוך ידנית, להריץ את הסקריפט מחדש במקום.",
        " * prereq: דרישת קדם (חץ רציף) · adjoining: מקצוע צמוד/דרישת אחר (חץ מקווקו).",
        " * רק קשרים בין מקצועות שאנו עוקבים אחריהם (js/data.js) - לא כל דרישות הקדם",
        " * הרשמיות עשויות להופיע כאן אם הן מפנות למקצוע שלא בקטלוג שלנו.",
        " */",
        "window.FINDEG_PREREQS = " + json.dumps(results, ensure_ascii=False, indent=2) + ";",
    ]
    js_path = tools_dir.parent / "js" / "prereqs.js"
    js_path.write_text("\n".join(js_lines) + "\n", encoding="utf-8")
    print(f"Wrote {js_path}")


if __name__ == "__main__":
    main()
