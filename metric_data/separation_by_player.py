#!/usr/bin/env python3
"""Each route runner's mean separation at release.

Same coverage, alignment, and personnel keys as separation_by_coverage.json.
A cell is included only when that player has at least one sample.
"""

import csv
import json
from collections import defaultdict
from pathlib import Path

import separation_at_release as sep

OUTPUT_PATH = Path(__file__).resolve().parent / "separation_by_player.json"
PLAYERS_PATH = sep.ROOT / "data" / "players.csv"


def load_names():
    names = {}
    with PLAYERS_PATH.open(newline="") as handle:
        for row in csv.DictReader(handle):
            names[row["nflId"]] = row["displayName"]
    return names


def personnel_with_samples(codes):
    extras = sorted(code for code in codes if code not in sep.TABLE_PERSONNEL)
    return [code for code in sep.TABLE_PERSONNEL if code in codes] + extras


def collect_by_player(coverage, targets):
    samples = defaultdict(lambda: defaultdict(lambda: defaultdict(lambda: defaultdict(list))))
    for nfl_id, group, alignment, personnel, dist in sep.iter_separations(coverage, targets):
        samples[nfl_id][group][alignment][personnel].append(dist)
    return samples


def build_result(samples, names):
    result = {}
    for nfl_id in sorted(samples, key=int):
        player = {"displayName": names.get(nfl_id, nfl_id)}
        for group in sep.GROUPS:
            if group not in samples[nfl_id]:
                continue
            group_body = {}
            for alignment in sep.ALIGNMENTS:
                buckets = samples[nfl_id][group].get(alignment)
                if not buckets:
                    continue
                group_body[alignment] = {
                    code: {
                        "n": summary["n"],
                        "mean": summary["mean"],
                    }
                    for code in personnel_with_samples(buckets)
                    for summary in (sep.summarize(buckets[code]),)
                }
            if group_body:
                player[group] = group_body
        result[nfl_id] = player
    return result


def main():
    coverage = sep.load_coverage()
    targets = sep.load_targets(coverage)
    result = build_result(collect_by_player(coverage, targets), load_names())
    OUTPUT_PATH.write_text(json.dumps(result, indent=2) + "\n")
    print(f"wrote {OUTPUT_PATH} ({len(result)} players)")


if __name__ == "__main__":
    main()
