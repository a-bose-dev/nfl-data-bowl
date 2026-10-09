#!/usr/bin/env python3
"""Each route runner's mean separation at release.

Same coverage, alignment, and personnel keys as separation_by_coverage.json.
A cell is included only when that player has at least one sample.
"""

import json
from collections import defaultdict
from pathlib import Path

import separation_at_release as sep

OUTPUT_PATH = Path(__file__).resolve().parent / "separation_by_player.json"


def personnel_with_samples(codes):
    extras = sorted(code for code in codes if code not in sep.TABLE_PERSONNEL and code != sep.ALL_PERSONNEL)
    return [code for code in sep.TABLE_PERSONNEL if code in codes] + extras


def collect_by_player(coverage, targets, credited):
    samples = defaultdict(lambda: defaultdict(lambda: defaultdict(lambda: defaultdict(list))))
    for nfl_id, group, alignment, personnel, dist, yards in sep.iter_separations(coverage, targets, credited):
        samples[nfl_id][group][alignment][personnel].append((dist, yards))
    return samples


def cell_from_pairs(pairs):
    summary = sep.summarize([dist for dist, _yards in pairs], [yards for _dist, yards in pairs])
    return {"n": summary["n"], "mean": summary["mean"], "yards": summary["yards"]}


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
                codes = personnel_with_samples(buckets)
                pooled = [pair for code in codes for pair in buckets[code]]
                group_body[alignment] = {sep.ALL_PERSONNEL: cell_from_pairs(pooled)}
                for code in codes:
                    group_body[alignment][code] = cell_from_pairs(buckets[code])
            if group_body:
                player[group] = group_body
        result[nfl_id] = player
    return result


def main():
    coverage = sep.load_coverage()
    targets = sep.load_targets(coverage)
    names = sep.load_names()
    credited = sep.load_credited_yards(targets, names)
    result = build_result(collect_by_player(coverage, targets, credited), names)
    OUTPUT_PATH.write_text(json.dumps(result, indent=2) + "\n")
    print(f"wrote {OUTPUT_PATH} ({len(result)} players)")


if __name__ == "__main__":
    main()
