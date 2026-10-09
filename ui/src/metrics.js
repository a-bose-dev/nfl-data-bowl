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
const FORMATION_ORDER = ["all", "11", "12", "21", "22", "10", "20", "13", "01", "00", "02", "31", "23"];

export const ALL = "all";

export function labelCoverage(key) {
  if (key === ALL) return "All";
  return COVERAGE_LABELS[key] || key;
}

export function labelAlignment(key) {
  if (key === ALL) return "All";
  return ALIGNMENT_LABELS[key] || key;
}

export function labelFormation(code) {
  if (code === "all") return "All formations";
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

function poolCells(cells) {
  let n = 0;
  let weighted = 0;
  let yards = 0;
  for (const cell of cells) {
    if (!cell || !cell.n || cell.mean == null) continue;
    n += cell.n;
    weighted += cell.mean * cell.n;
    if (cell.yards != null) yards += cell.yards;
  }
  if (!n) return null;
  return { n, mean: weighted / n, yards };
}

function coverageKeys(coverageData, group) {
  if (group === ALL) return COVERAGE_ORDER.filter((key) => coverageData?.[key]);
  return coverageData?.[group] ? [group] : [];
}

function alignmentKeys(coverageData, group, alignment) {
  if (alignment !== ALL) return [alignment];
  const found = new Set();
  for (const key of coverageKeys(coverageData, group)) {
    for (const name of Object.keys(coverageData[key] || {})) found.add(name);
  }
  return orderedKeys([...found], ALIGNMENT_ORDER);
}

export function cellFor(coverageData, group, alignment, formation) {
  if (group !== ALL && alignment !== ALL) {
    return coverageData?.[group]?.[alignment]?.[formation] || null;
  }
  const cells = [];
  for (const key of coverageKeys(coverageData, group)) {
    for (const name of alignmentKeys(coverageData, key, alignment)) {
      const cell = coverageData?.[key]?.[name]?.[formation];
      if (cell) cells.push(cell);
    }
  }
  return poolCells(cells);
}

export function formationsFor(coverageData, group, alignment) {
  const codes = new Set();
  for (const key of coverageKeys(coverageData, group)) {
    for (const name of alignmentKeys(coverageData, key, alignment)) {
      const bucket = coverageData?.[key]?.[name] || {};
      for (const code of Object.keys(bucket)) {
        const cell = bucket[code];
        if (cell && cell.n > 0 && cell.mean != null) codes.add(code);
      }
    }
  }
  return orderedKeys([...codes], FORMATION_ORDER);
}

export function alignmentsFor(coverageData, group) {
  const found = new Set();
  for (const key of coverageKeys(coverageData, group)) {
    for (const name of Object.keys(coverageData[key] || {})) {
      if (formationsFor(coverageData, key, name).length > 0) found.add(name);
    }
  }
  return [ALL, ...orderedKeys([...found], ALIGNMENT_ORDER)];
}

export function coveragesFor(coverageData) {
  const keys = orderedKeys(
    Object.keys(coverageData).filter((key) => alignmentsFor(coverageData, key).length > 1),
    COVERAGE_ORDER,
  );
  return [ALL, ...keys];
}

function playerSample(player, group, alignment, formation) {
  const groups = group === ALL ? Object.keys(player).filter((key) => key !== "displayName") : [group];
  const cells = [];
  for (const key of groups) {
    const bucket = player[key];
    if (!bucket || typeof bucket !== "object") continue;
    const names = alignment === ALL ? Object.keys(bucket) : [alignment];
    for (const name of names) {
      const sample = bucket?.[name]?.[formation];
      if (sample) cells.push(sample);
    }
  }
  return poolCells(cells);
}

function sortedQuantile(sorted, p) {
  if (!sorted.length) return null;
  if (sorted.length === 1) return sorted[0];
  const rank = (sorted.length - 1) * p;
  const low = Math.floor(rank);
  const high = Math.ceil(rank);
  if (low === high) return sorted[low];
  const weight = rank - low;
  return sorted[low] * (1 - weight) + sorted[high] * weight;
}

export function snapBounds(coverageData, playerData, group, alignment, formation) {
  const counts = [];
  for (const player of Object.values(playerData)) {
    const sample = playerSample(player, group, alignment, formation);
    if (sample && sample.n >= 1) counts.push(sample.n);
  }
  if (!counts.length) return { mean: 1, max: 1 };
  const mean = counts.reduce((sum, count) => sum + count, 0) / counts.length;
  return {
    mean: Math.max(1, Math.round(mean)),
    max: Math.max(...counts),
  };
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

export function yardsPerRoute(cell) {
  if (!cell || !cell.n || cell.yards == null) return null;
  return cell.yards / cell.n;
}

export function qualifiedPlayers(coverageData, playerData, group, alignment, formation, minSnaps) {
  const expected = cellFor(coverageData, group, alignment, formation);
  if (!expected || expected.mean == null) return [];
  const rows = [];
  for (const [nflId, player] of Object.entries(playerData)) {
    const sample = playerSample(player, group, alignment, formation);
    if (!sample || sample.n < minSnaps || sample.mean == null) continue;
    const routeYards = yardsPerRoute(sample);
    if (routeYards == null) continue;
    rows.push({
      nflId,
      name: player.displayName || nflId,
      n: sample.n,
      mean: sample.mean,
      metric: sample.mean - expected.mean,
      yardsPerRoute: routeYards,
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

export function centralMetrics(values) {
  const sorted = values.filter((value) => Number.isFinite(value)).slice().sort((a, b) => a - b);
  const low = sortedQuantile(sorted, 0.01);
  const high = sortedQuantile(sorted, 0.99);
  if (!Number.isFinite(low) || !Number.isFinite(high)) return { low: null, high: null, values: [] };
  return {
    low,
    high,
    values: sorted.filter((value) => value >= low && value <= high),
  };
}

export function kdeCurve(values) {
  const xs = values.filter((value) => Number.isFinite(value)).slice().sort((a, b) => a - b);
  const count = xs.length;
  if (count < 2) return [];
  const mean = xs.reduce((sum, value) => sum + value, 0) / count;
  const variance = xs.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (count - 1);
  const sigma = Math.sqrt(Math.max(variance, 0));
  const quantile = (p) => {
    const rank = (count - 1) * p;
    const low = Math.floor(rank);
    const high = Math.ceil(rank);
    if (low === high) return xs[low];
    const weight = rank - low;
    return xs[low] * (1 - weight) + xs[high] * weight;
  };
  const iqr = quantile(0.75) - quantile(0.25);
  const robust = iqr > 0 ? iqr / 1.34 : sigma;
  const scale = sigma > 0 && robust > 0 ? Math.min(sigma, robust) : sigma || robust;
  const bandwidth = 0.9 * scale * count ** (-1 / 5);
  if (!(bandwidth > 0)) return [];

  const pad = 3 * bandwidth;
  const x0 = xs[0] - pad;
  const x1 = xs[count - 1] + pad;
  const steps = 160;
  const inv = 1 / (bandwidth * Math.sqrt(2 * Math.PI) * count);
  const points = [];
  for (let i = 0; i <= steps; i += 1) {
    const x = x0 + ((x1 - x0) * i) / steps;
    let y = 0;
    for (const value of xs) {
      const z = (x - value) / bandwidth;
      y += Math.exp(-0.5 * z * z);
    }
    points.push({ x, y: y * inv });
  }
  return points;
}
