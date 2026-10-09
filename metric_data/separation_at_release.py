#!/usr/bin/env python3
"""Separation at ball release, by coverage, alignment, and offensive personnel.

Separation is the straight-line distance (yards) from a route runner to the
nearest player on the opposing team at the pass_forward frame.
"""

import csv
import json
import math
import re
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PLAYS_PATH = ROOT / "data" / "plays.csv"
SCOUTING_PATH = ROOT / "data" / "pffScoutingData.csv"
TRACKING_DIR = ROOT / "data" / "tracking"
OUTPUT_PATH = Path(__file__).resolve().parent / "separation_by_coverage.json"

COVERAGE_GROUP = {
    "Cover-0": "man",
    "Cover-1": "man",
    "2-Man": "man",
    "Bracket": "man",
    "Cover-2": "zonal",
    "Cover-3": "zonal",
    "Quarters": "zonal",
    "Cover-6": "zonal",
    "Red Zone": "red_zone",
}

ALIGNMENT = {
    "LWR": "wide",
    "RWR": "wide",
    "SLWR": "slot",
    "SRWR": "slot",
    "SLiWR": "slot",
    "SLoWR": "slot",
    "SRiWR": "slot",
    "SRoWR": "slot",
}

GROUPS = ("man", "zonal", "red_zone")
ALIGNMENTS = ("wide", "slot")
# First digit is RB count, second is TE count.
TABLE_PERSONNEL = ("11", "12", "21", "22", "10", "20", "13", "01", "00", "02", "31", "23")
PERCENTILES = (0, 10, 25, 50, 75, 90, 100)
RB_COUNT = re.compile(r"(\d+)\s*RB")
TE_COUNT = re.compile(r"(\d+)\s*TE")


def personnel_code(raw):
    """Two-digit personnel from a personnelO string. Extra OL, QB, or LB are ignored."""
    rb = RB_COUNT.search(raw or "")
    te = TE_COUNT.search(raw or "")
    if rb is None or te is None:
        return None
    return f"{rb.group(1)}{te.group(1)}"


def load_coverage():
    """Map (gameId, playId) to (coverage group, personnel). Unmapped plays are omitted."""
    coverage = {}
    with PLAYS_PATH.open(newline="") as handle:
        for row in csv.DictReader(handle):
            group = COVERAGE_GROUP.get(row["pff_passCoverage"])
            personnel = personnel_code(row["personnelO"])
            if group is not None and personnel is not None:
                coverage[(row["gameId"], row["playId"])] = (group, personnel)
    return coverage


def load_targets(coverage):
    """Map (gameId, playId, nflId) to wide/slot for pass-route runners on kept plays."""
    targets = {}
    with SCOUTING_PATH.open(newline="") as handle:
        for row in csv.DictReader(handle):
            if row["pff_role"] != "Pass Route":
                continue
            alignment = ALIGNMENT.get(row["pff_positionLinedUp"])
            if alignment is None:
                continue
            key = (row["gameId"], row["playId"])
            if key not in coverage:
                continue
            targets[(*key, row["nflId"])] = alignment
    return targets


def percentile(sorted_values, pct):
    """Linear-interpolation percentile. 0 and 100 are the min and max."""
    if pct <= 0:
        return sorted_values[0]
    if pct >= 100:
        return sorted_values[-1]
    rank = (len(sorted_values) - 1) * (pct / 100)
    low = math.floor(rank)
    high = math.ceil(rank)
    if low == high:
        return sorted_values[low]
    weight = rank - low
    return sorted_values[low] * (1 - weight) + sorted_values[high] * weight


def nearest_defender(receiver, players):
    """Yards to the closest player who is not on the receiver's team or the ball."""
    rx, ry = receiver["x"], receiver["y"]
    team = receiver["team"]
    best = None
    for player in players:
        if player["team"] == team or player["team"] == "football":
            continue
        dist = math.hypot(player["x"] - rx, player["y"] - ry)
        if best is None or dist < best:
            best = dist
    return best


def separations_for_frame(players, play_key, targets):
    """Separation for each wide/slot route runner present on this frame."""
    found = []
    for player in players:
        alignment = targets.get((*play_key, player["nflId"]))
        if alignment is None:
            continue
        dist = nearest_defender(player, players)
        if dist is not None:
            found.append((player["nflId"], alignment, dist))
    return found


def iter_separations(coverage, targets):
    """Yield (nflId, coverage, alignment, personnel, distance) at each pass_forward."""
    plays_with_targets = {(game, play) for game, play, _nfl in targets}
    for path in sorted(TRACKING_DIR.glob("tracking_*.csv")):
        frames = defaultdict(list)
        with path.open(newline="") as handle:
            for row in csv.DictReader(handle):
                if row["event"] != "pass_forward":
                    continue
                play_key = (row["gameId"], row["playId"])
                if play_key not in plays_with_targets:
                    continue
                try:
                    x = float(row["x"])
                    y = float(row["y"])
                except ValueError:
                    continue
                frames[play_key].append(
                    {"nflId": row["nflId"], "team": row["team"], "x": x, "y": y}
                )

        for play_key, players in frames.items():
            group, personnel = coverage[play_key]
            for nfl_id, alignment, dist in separations_for_frame(players, play_key, targets):
                yield nfl_id, group, alignment, personnel, dist


def collect_separations(coverage, targets):
    """Stream tracking files and keep pass_forward separations for target receivers."""
    values = {
        group: {
            alignment: {code: [] for code in TABLE_PERSONNEL}
            for alignment in ALIGNMENTS
        }
        for group in GROUPS
    }
    for _nfl_id, group, alignment, personnel, dist in iter_separations(coverage, targets):
        values[group][alignment].setdefault(personnel, []).append(dist)
    return values


def summarize(samples):
    ordered = sorted(samples)
    return {
        "n": len(ordered),
        "mean": round(sum(ordered) / len(ordered), 4) if ordered else None,
        "percentiles": {
            str(pct): round(percentile(ordered, pct), 4) if ordered else None
            for pct in PERCENTILES
        },
    }


def personnel_keys(samples):
    """Table codes first, then any extra RB-TE codes that actually occurred."""
    extras = sorted(code for code in samples if code not in TABLE_PERSONNEL)
    return list(TABLE_PERSONNEL) + extras


def main():
    coverage = load_coverage()
    targets = load_targets(coverage)
    values = collect_separations(coverage, targets)
    result = {
        group: {
            alignment: {
                code: summarize(values[group][alignment][code])
                for code in personnel_keys(values[group][alignment])
            }
            for alignment in ALIGNMENTS
        }
        for group in GROUPS
    }
    OUTPUT_PATH.write_text(json.dumps(result, indent=2) + "\n")
    print(f"wrote {OUTPUT_PATH}")
    for group in GROUPS:
        for alignment in ALIGNMENTS:
            for code, cell in result[group][alignment].items():
                if cell["n"]:
                    print(f"  {group} {alignment} {code}: n={cell['n']} mean={cell['mean']}")


if __name__ == "__main__":
    main()
