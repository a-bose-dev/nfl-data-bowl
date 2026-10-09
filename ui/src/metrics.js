export const COVERAGE_LABELS = {
  man: "Man",
  zonal: "Zone",
  red_zone: "Red zone",
};

export const ALIGNMENT_LABELS = {
  wide: "Wide",
  slot: "Slot",
};

const COVERAGE_ORDER = ["man", "zonal", "red_zone"];
const ALIGNMENT_ORDER = ["wide", "slot"];
const FORMATION_ORDER = ["11", "12", "21", "22", "10", "20", "13", "01", "00", "02", "31", "23"];
const PERCENTILE_KNOTS = [0, 10, 25, 50, 75, 90, 100];

export function labelCoverage(key) {
  return COVERAGE_LABELS[key] || key;
}

export function labelAlignment(key) {
  return ALIGNMENT_LABELS[key] || key;
}

export function labelFormation(code) {
  const rb = Number(code[0]);
  const te = Number(code.slice(1));
  return `${code} · ${rb} RB, ${te} TE`;
}

export function orderedKeys(keys, preferred) {
  const present = new Set(keys);
  const head = preferred.filter((key) => present.has(key));
  const tail = [...keys].filter((key) => !preferred.includes(key)).sort();
  return head.concat(tail);
}

export function cellFor(coverageData, group, alignment, formation) {
  return coverageData?.[group]?.[alignment]?.[formation] || null;
}

export function formationsFor(coverageData, group, alignment) {
  const bucket = coverageData?.[group]?.[alignment] || {};
  return orderedKeys(
    Object.keys(bucket).filter((code) => bucket[code] && bucket[code].n > 0 && bucket[code].mean != null),
    FORMATION_ORDER,
  );
}

export function alignmentsFor(coverageData, group) {
  const bucket = coverageData?.[group] || {};
  return orderedKeys(
    Object.keys(bucket).filter((key) => formationsFor(coverageData, group, key).length > 0),
    ALIGNMENT_ORDER,
  );
}

export function coveragesFor(coverageData) {
  return orderedKeys(
    Object.keys(coverageData).filter((key) => ALIGNMENT_ORDER.some((alignment) => formationsFor(coverageData, key, alignment).length)),
    COVERAGE_ORDER,
  );
}

export function formatYards(value, digits) {
  return value.toFixed(digits);
}

export function formatSigned(value) {
  const rounded = Math.round(value * 10) / 10;
  const body = Math.abs(rounded).toFixed(1);
  if (rounded > 0) return `+${body}`;
  if (rounded < 0) return `−${body}`;
  return "0.0";
}

export function formatCount(value) {
  return value.toLocaleString("en-US");
}

export function qualifiedPlayers(coverageData, playerData, group, alignment, formation, minSnaps) {
  const expected = cellFor(coverageData, group, alignment, formation);
  if (!expected || expected.mean == null) return [];
  const rows = [];
  for (const [nflId, player] of Object.entries(playerData)) {
    const sample = player?.[group]?.[alignment]?.[formation];
    if (!sample || sample.n < minSnaps || sample.mean == null) continue;
    rows.push({
      nflId,
      name: player.displayName || nflId,
      n: sample.n,
      mean: sample.mean,
      metric: sample.mean - expected.mean,
    });
  }
  rows.sort((a, b) => b.metric - a.metric || a.name.localeCompare(b.name));
  const count = rows.length;
  for (const row of rows) {
    if (count === 1) {
      row.quantile = 100;
      continue;
    }
    const below = rows.filter((other) => other.metric < row.metric).length;
    const tied = rows.filter((other) => other.metric === row.metric).length;
    const raw = ((below + (tied - 1) / 2) / (count - 1)) * 100;
    row.quantile = raw >= 100 ? 100 : Math.min(99, Math.round(raw));
  }
  return rows;
}

export function densityBins(percentiles) {
  const knots = PERCENTILE_KNOTS.map((pct) => ({
    pct,
    x: percentiles[String(pct)],
  })).filter((knot) => Number.isFinite(knot.x));
  const bins = [];
  for (let i = 0; i < knots.length - 1; i += 1) {
    const x0 = knots[i].x;
    const x1 = knots[i + 1].x;
    const width = x1 - x0;
    const mass = (knots[i + 1].pct - knots[i].pct) / 100;
    if (width <= 1e-6 || mass <= 0) continue;
    bins.push({
      x0,
      x1,
      center: (x0 + x1) / 2,
      width,
      density: mass / width,
      from: knots[i].pct,
      to: knots[i + 1].pct,
    });
  }
  return bins;
}
