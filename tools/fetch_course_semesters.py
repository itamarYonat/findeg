"""Check which semesters our tracked FinDeg courses are actually offered in.

Combines two public, no-login data sources behind CheeseFork (https://cheesefork.cf):

1. technion-sap-info-fetcher (sap.cheesefork.cf) - real SAP *schedule* data (actual
   group/day/hour/room/lecturer rows) for a handful of recent/upcoming semesters.
   Forward-looking: tells us what's currently scheduled, but a scheduled group isn't
   proof it actually ran as a real full offering (could be a thin/administrative
   section - see the "confirmed" signal below for why this matters).

2. technion-histograms (michael-maltsev.github.io/technion-histograms) - real,
   official grade histograms that students voluntarily share from
   grades.technion.ac.il. A course having a *completed* grade histogram for a given
   semester is much stronger evidence it was actually given than a schedule entry -
   you can't have real exam results for a class that didn't really happen. This is
   the "confirmed" signal and takes priority when available.

Two earlier approaches were tried and found wrong here, in order:
  - Raw SAP `SmObjectSet` existence check: reflected the course's general *declared*
    offering pattern (ZzOfferpattern, e.g. "WISP"), not a specific term's real
    schedule. Produced false positives.
  - SAP *schedule* data alone (source #1 above): closer, but still forward-looking/
    provisional - e.g. 00140006 (מבוא לשיטות נומריות) showed a real-looking but
    tiny single-group "winter" schedule entry for חורף תשפ"ו, while its grade
    history (source #2) shows zero completed winter offerings since the תשפ"ד
    catalog took effect (it *used* to run both seasons every year 2015-2022, then
    switched to spring-only) - i.e. that scheduled winter group is not
    representative of the course's real current pattern.

So: "confirmed" (from real completed grades, restricted to the academic years our
catalogs actually cover - see RECENT_YEARS) is used whenever any exist; "scheduled"
(from source #1) is only a fallback for courses with no grade-history evidence at
all (new/rare courses nobody has crowd-shared grades for yet).

technion-histograms semester key format: "YYYY0N" - YYYY = calendar year the
academic year starts (matches SAP Peryr exactly), N: 1=winter, 2=spring, 3=summer.
Confirmed empirically against 00140102 (a course every first-year student takes in
winter): "01" keys have ~185-190 students/year (the full incoming cohort), "02" keys
have 36-85 (a smaller spring retake tail).

Usage:
    python tools/fetch_course_semesters.py

Output: tools/course_semesters.json (full detail incl. both signals + confirmed
flag), and js/semesters.js (compact per-course {seasons, confirmed} for the
frontend).
"""
import json
import re
import sys
import time
from pathlib import Path

import requests

sys.stdout.reconfigure(encoding="utf-8")

# ---- source #1: real scheduled groups for recent/upcoming semesters ----
SAP_SEMESTERS = [
    (2025, 200, "winter", "חורף תשפ\"ו"),
    (2025, 201, "spring", "אביב תשפ\"ו"),
    (2025, 202, "summer", "קיץ תשפ\"ו"),
    (2026, 200, "winter", "חורף תשפ\"ז"),
]
SAP_DATA_BASE_URL = "https://michael-maltsev.github.io/technion-sap-info-fetcher/"

# ---- source #2: real completed grade histograms, current-catalog years only ----
HISTOGRAMS_BASE_URL = "https://michael-maltsev.github.io/technion-histograms/"
HISTOGRAMS_SEASON_BY_SUFFIX = {"1": "winter", "2": "spring", "3": "summer"}


def get_recent_years(data_js_text: str) -> set:
    """The academic-year-start years our own catalogs cover (yearCatalogs in data.js) -
    e.g. {"2023", "2024", "2025"}. Deliberately not using older grade history: at least
    one course's real pattern demonstrably changed when the תשפ"ד catalog took effect,
    so older evidence could misrepresent the current catalog era."""
    m = re.search(r"const yearCatalogs = \{([^}]*)\}", data_js_text)
    return set(re.findall(r"(\d{4}):", m.group(1)))


def fetch_sap_semester_courses(year: int, sem: int):
    url = f"{SAP_DATA_BASE_URL}courses_{year}_{sem}.json"
    response = requests.get(url, timeout=60)
    response.raise_for_status()
    return response.json()


def get_scheduled_course_ids(courses: list) -> set:
    """Course ids with at least one real scheduled teaching group this semester."""
    offered = set()
    for course in courses:
        course_id = course.get("general", {}).get("מספר מקצוע")
        if not course_id:
            continue
        groups = {row.get("קבוצה") for row in course.get("schedule") or []}
        if groups:
            offered.add(course_id)
    return offered


def fetch_histogram(course_id: str):
    url = f"{HISTOGRAMS_BASE_URL}{course_id}/index.min.json"
    response = requests.get(url, timeout=30)
    if response.status_code != 200:
        return None
    try:
        return response.json()
    except ValueError:
        return None


def has_real_numeric_grade(sem_data: dict) -> bool:
    for category in ("Finals", "Final_A", "Exam_A"):
        stat = sem_data.get(category)
        if not stat:
            continue
        average = stat.get("average")
        if average in ("", None):
            continue
        try:
            float(average)
            return True
        except ValueError:
            continue
    return False


def get_confirmed_seasons(histogram: dict, recent_years: set) -> set:
    if not histogram:
        return set()
    confirmed = set()
    for key, sem_data in histogram.items():
        if not re.fullmatch(r"\d{6}", key):
            continue
        year, suffix = key[:4], key[5:6]
        if year not in recent_years:
            continue
        season = HISTOGRAMS_SEASON_BY_SUFFIX.get(suffix)
        if season and has_real_numeric_grade(sem_data):
            confirmed.add(season)
    return confirmed


def main():
    data_js_text = (Path(__file__).parent.parent / "js" / "data.js").read_text(encoding="utf-8")
    our_ids = sorted(set(re.findall(r'"(\d{8})":\s*"', data_js_text)))
    recent_years = get_recent_years(data_js_text)
    print(f"Tracking {len(our_ids)} course ids from js/data.js")
    print(f"Recent years for grade-confirmation window: {sorted(recent_years)}")

    # ---- source #1 ----
    scheduled_by_semester = {}
    for year, sem, season, label in SAP_SEMESTERS:
        key = f"{year}-{sem}"
        print(f"Fetching scheduled groups: {label} ({key})...")
        courses = fetch_sap_semester_courses(year, sem)
        ids = get_scheduled_course_ids(courses)
        scheduled_by_semester[key] = (season, ids)
        print(f"  {len(courses)} in catalog, {len(ids)} with a real scheduled group, {len(ids & set(our_ids))} match our catalog")
        time.sleep(1)

    scheduled_seasons = {cid: set() for cid in our_ids}
    for season, ids in scheduled_by_semester.values():
        for cid in ids:
            if cid in scheduled_seasons:
                scheduled_seasons[cid].add(season)

    # ---- source #2 ----
    print(f"\nFetching grade histograms for {len(our_ids)} courses...")
    confirmed_seasons = {}
    for i, cid in enumerate(our_ids):
        histogram = fetch_histogram(cid)
        confirmed_seasons[cid] = get_confirmed_seasons(histogram, recent_years)
        if (i + 1) % 40 == 0:
            print(f"  {i + 1}/{len(our_ids)}...")
        time.sleep(0.05)

    # ---- combine: confirmed (real grades) takes priority; scheduled is a fallback
    # for courses with no grade-history evidence at all ----
    season_order = {"winter": 0, "spring": 1, "summer": 2}
    detail = {}
    compact = {}
    n_confirmed = n_fallback = n_unknown = 0
    for cid in our_ids:
        confirmed = confirmed_seasons.get(cid, set())
        scheduled = scheduled_seasons.get(cid, set())
        if confirmed:
            seasons, is_confirmed = confirmed, True
            n_confirmed += 1
        elif scheduled:
            seasons, is_confirmed = scheduled, False
            n_fallback += 1
        else:
            seasons, is_confirmed = set(), False
            n_unknown += 1

        detail[cid] = {
            "confirmedSeasons": sorted(confirmed, key=lambda s: season_order[s]),
            "scheduledSeasons": sorted(scheduled, key=lambda s: season_order[s]),
        }
        if seasons:
            compact[cid] = {
                "seasons": sorted(seasons, key=lambda s: season_order[s]),
                "confirmed": is_confirmed,
            }

    print(f"\nConfirmed by real grade history: {n_confirmed}")
    print(f"Fallback to scheduled-only (no grade history): {n_fallback}")
    print(f"No signal at all: {n_unknown}")

    out_path = Path(__file__).parent / "course_semesters.json"
    out_path.write_text(json.dumps(detail, ensure_ascii=False, indent=2, sort_keys=True), encoding="utf-8")
    print(f"\nWrote {out_path}")

    js_lines = [
        "/* FinDeg – סמסטרים בהם כל מקצוע ניתן בפועל.",
        " * שני מקורות ציבוריים, ללא צורך בהתחברות, שעליהם מבוסס גם CheeseFork:",
        " * (1) technion-sap-info-fetcher - קבוצות הוראה מתוזמנות בפועל (SAP), לסמסטרים",
        " *     האחרונים/הקרובים בלבד - זהו מקור \"קדימה\", לא תמיד מייצג (למשל קבוצה",
        " *     בודדת שנפתחה מנהלתית ולא כהיצע אמיתי).",
        " * (2) technion-histograms - היסטוגרמות ציונים רשמיות ואמיתיות ששיתפו סטודנטים",
        " *     - קיום היסטוגרמה שלמה לסמסטר הוא הוכחה חזקה בהרבה שהמקצוע אכן ניתן",
        " *     (אי אפשר לקבל ציונים אמיתיים למקצוע שלא התקיים). זהו האות \"מאומת\"",
        " *     (confirmed:true) ומקבל עדיפות; מוגבל לשנים שהקטלוגים שלנו מכסים בפועל",
        " *     (ראו yearCatalogs ב-data.js) - היסטוריה ישנה יותר עלולה להטעות אם דפוס",
        " *     ההיצע השתנה (זה קרה בפועל לפחות למקצוע אחד עם מעבר הקטלוג לתשפ\"ד).",
        " * מקצוע עם confirmed:false מסתמך רק על המקור ה\"קדימה\" (אין לו היסטוריית",
        " * ציונים משותפת בכלל) - פחות אמין. מקצוע שלא מופיע כאן כלל - אין לו אות",
        " * מאף אחד משני המקורות.",
        " * קובץ זה מיוצר אוטומטית ע\"י tools/fetch_course_semesters.py - אין לערוך ידנית.",
        " */",
        "window.FINDEG_SEMESTERS = " + json.dumps(compact, ensure_ascii=False, indent=2, sort_keys=True) + ";",
    ]
    js_path = Path(__file__).parent.parent / "js" / "semesters.js"
    js_path.write_text("\n".join(js_lines) + "\n", encoding="utf-8")
    print(f"Wrote {js_path}")


if __name__ == "__main__":
    main()
