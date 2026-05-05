#!/usr/bin/env python3
import csv
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
CSV_PATH = ROOT / "abstracts.csv"
OUTPUT_PATH = ROOT / "web" / "data.js"

TRACK_LABELS = {
    "Jet modification and medium response": "Jet",
    "High-momentum hadrons and correlations": "HighPT",
    "Heavy quarks and quarkonia": "HF",
    "Nuclear PDFs, saturation, and early-time dynamics": "nPDF/saturation/early",
    "Electromagnetic and electroweak probes": "EM",
    "Future experimental facilities and new techniques": "Future",
    "ML/AI and quantum computing in high-energy nuclear physics": "AI/ML",
}
FORCE_INCLUDE_IDS = {"341", "142", "46", "104"}
EXCLUDED_IDS = {"7", "37", "337", "272", "10", "89"}


def load_contributions():
    with CSV_PATH.open(newline="", encoding="utf-8-sig") as handle:
        reader = csv.DictReader(handle)
        contributions = []
        for row in reader:
            contribution_id = row["Id"].strip()
            if contribution_id in EXCLUDED_IDS:
                continue
            if row.get("State", "").strip() != "Accepted":
                continue
            is_forced_include = contribution_id in FORCE_INCLUDE_IDS
            if (
                row.get("Accepted type", "").strip() != "Oral presentation"
                and not is_forced_include
            ):
                continue

            accepted_track = row.get("Accepted track", "").strip()
            submitted_track = row.get("Submitted for tracks", "").strip()
            track = accepted_track or submitted_track
            if track not in TRACK_LABELS:
                continue

            contributions.append(
                {
                    "id": contribution_id,
                    "title": row["Title"].strip(),
                    "track": TRACK_LABELS[track],
                    "sourceTrack": track,
                    "talkType": (
                        "experimental"
                        if row.get("Is this an experimental talk?", "").strip().lower() == "yes"
                        else "theory"
                    ),
                }
            )

    contributions.sort(key=lambda item: (item["track"], item["id"]))
    return contributions


def main():
    payload = {
        "columns": [
            "Not decided",
            "Jet",
            "Substructure",
            "HighPT",
            "EEC",
            "Small System",
            "HF",
            "nPDF/saturation/early",
            "EM",
            "Future",
            "AI/ML",
        ],
        "contributions": load_contributions(),
    }
    OUTPUT_PATH.write_text(
        "window.APP_DATA = " + json.dumps(payload, indent=2) + ";\n",
        encoding="utf-8",
    )
    print(f"Wrote {len(payload['contributions'])} contributions to {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
