import { useMemo, useState } from "react";
import coverageData from "../../metric_data/separation_by_coverage.json";
import playerData from "../../metric_data/separation_by_player.json";
import DistributionChart from "./DistributionChart.jsx";
import QuadrantChart from "./QuadrantChart.jsx";
import {
  alignmentsFor,
  cellFor,
  coveragesFor,
  formatCount,
  formatSigned,
  formatYards,
  formationsFor,
  labelAlignment,
  labelCoverage,
  labelFormation,
  qualifiedPlayers,
  snapBounds,
  yardsPerRoute,
} from "./metrics.js";

const coverages = coveragesFor(coverageData);
const initialSnaps = snapBounds(coverageData, playerData, "all", "all", "all");

function keepOrFirst(options, current) {
  return options.includes(current) ? current : options[0] || "";
}

export default function App() {
  const [coverage, setCoverage] = useState("all");
  const [alignment, setAlignment] = useState("all");
  const [formation, setFormation] = useState("all");
  const [minSnaps, setMinSnaps] = useState(initialSnaps.mean);
  const [selectedId, setSelectedId] = useState(null);

  const alignments = alignmentsFor(coverageData, coverage);
  const formations = formationsFor(coverageData, coverage, alignment);
  const bounds = useMemo(
    () => snapBounds(coverageData, playerData, coverage, alignment, formation),
    [coverage, alignment, formation],
  );
  const activeMin = Math.min(Math.max(minSnaps, 1), bounds.max);

  const expected = cellFor(coverageData, coverage, alignment, formation);
  const rows = useMemo(() => {
    if (activeMin == null) return [];
    return qualifiedPlayers(coverageData, playerData, coverage, alignment, formation, activeMin);
  }, [coverage, alignment, formation, activeMin]);

  const selected = rows.find((row) => row.nflId === selectedId) || null;

  function applyMinSnaps(nextCoverage, nextAlignment, nextFormation) {
    setMinSnaps(snapBounds(coverageData, playerData, nextCoverage, nextAlignment, nextFormation).mean);
  }

  function chooseCoverage(next) {
    const nextAlignments = alignmentsFor(coverageData, next);
    const nextAlignment = keepOrFirst(nextAlignments, alignment);
    const nextFormations = formationsFor(coverageData, next, nextAlignment);
    const nextFormation = keepOrFirst(nextFormations, formation);
    setCoverage(next);
    setAlignment(nextAlignment);
    setFormation(nextFormation);
    applyMinSnaps(next, nextAlignment, nextFormation);
  }

  function chooseAlignment(next) {
    const nextFormations = formationsFor(coverageData, coverage, next);
    const nextFormation = keepOrFirst(nextFormations, formation);
    setAlignment(next);
    setFormation(nextFormation);
    applyMinSnaps(coverage, next, nextFormation);
  }

  const status = rows.length === 0
    ? "No players at or above the snap minimum."
    : rows.length === 1
      ? "1 player at or above the snap minimum."
      : `${formatCount(rows.length)} players at or above the snap minimum.`;

  const formationPhrase = formation === "all" ? "all formations" : labelFormation(formation);
  const leagueRouteYards = yardsPerRoute(expected);

  const meta =
    expected && expected.mean != null
      ? `${formatCount(expected.n)} plays in ${labelCoverage(coverage).toLowerCase()} coverage, ${labelAlignment(alignment).toLowerCase()} alignment, ${formationPhrase}.`
      : "This configuration has no league sample.";

  let chartCopy = "Kernel density of separation above expected, limited to the 1st through 99th percentile. Hover a player to mark them on the curve.";
  if (selected) {
    chartCopy = `${selected.name} is ${formatSigned(selected.metric)} yards above expected.`;
  }

  return (
    <>
      <header className="mast">
        <div className="mast-inner">
          <h1>Separation leaders</h1>
          <p className="lede">Yards of separation above the average for this coverage, alignment, and formation.</p>
        </div>
      </header>

      <main className="page">
        <form className="filters" onSubmit={(event) => event.preventDefault()}>
          <label>
            Coverage
            <select value={coverage} onChange={(event) => chooseCoverage(event.target.value)}>
              {coverages.map((key) => (
                <option key={key} value={key}>{labelCoverage(key)}</option>
              ))}
            </select>
          </label>
          <label>
            Alignment
            <select value={alignment} onChange={(event) => chooseAlignment(event.target.value)}>
              {alignments.map((key) => (
                <option key={key} value={key}>{labelAlignment(key)}</option>
              ))}
            </select>
          </label>
          <label>
            Formation
            <select
              value={formation}
              onChange={(event) => {
                const next = event.target.value;
                setFormation(next);
                applyMinSnaps(coverage, alignment, next);
              }}
            >
              {formations.map((code) => (
                <option key={code} value={code}>{labelFormation(code)}</option>
              ))}
            </select>
          </label>
          <label className="snap-control">
            <span>Minimum snaps</span>
            <input
              type="range"
              min="1"
              max={bounds.max}
              step="1"
              value={activeMin}
              aria-valuetext={`${formatCount(activeMin)} snaps`}
              onChange={(event) => setMinSnaps(Number(event.target.value))}
            />
            <span className="snap-value">{formatCount(activeMin)}</span>
          </label>
        </form>

        <p className="status" role="status">{status}</p>

        <div className="board">
          <section className="leaders" aria-labelledby="average-heading">
            <div className="average">
              <p className="average-value">{expected?.mean == null ? "—" : formatYards(expected.mean, 2)}</p>
              <h2 id="average-heading">Average separation</h2>
              <p className="average-meta">{meta}</p>
            </div>
            <div className="table-scroll">
              <table>
                <caption className="sr-only">Receivers ranked by separation above expected for the selected configuration</caption>
                <thead>
                  <tr>
                    <th scope="col">Rank</th>
                    <th scope="col">Player</th>
                    <th scope="col" className="num">Snaps</th>
                    <th scope="col" className="num">Metric</th>
                    <th scope="col" className="num">Quantile</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr>
                      <td className="empty-cell" colSpan={5}>
                        No players have this many snaps in the selected configuration. Lower the minimum to widen the list.
                      </td>
                    </tr>
                  ) : (
                    rows.map((row, index) => {
                      const shown = Math.round(row.metric * 10) / 10;
                      const tone = shown > 0 ? "metric-pos" : shown < 0 ? "metric-neg" : "";
                      const selectedRow = row.nflId === selectedId;
                      return (
                        <tr
                          key={row.nflId}
                          className={selectedRow ? "player-row is-selected" : "player-row"}
                          tabIndex={0}
                          aria-selected={selectedRow}
                          onMouseEnter={() => setSelectedId(row.nflId)}
                          onFocus={() => setSelectedId(row.nflId)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              setSelectedId(row.nflId);
                            }
                          }}
                        >
                          <td className="rank">{index + 1}</td>
                          <td className="name">{row.name}</td>
                          <td className="num">{formatCount(row.n)}</td>
                          <td className="num"><span className={tone}>{formatSigned(row.metric)}</span></td>
                          <td className="num">{Math.round(row.quantile)}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="quadrant" aria-labelledby="quadrant-heading">
            <h2 id="quadrant-heading">Separation and production</h2>
            <p className="quadrant-copy">
              Each player is separation above expected against yards per route run. The crosshairs are the league average and league yards per route for this configuration.
            </p>
            <QuadrantChart
              rows={rows}
              leagueYards={leagueRouteYards}
              selectedId={selectedId}
              onSelect={setSelectedId}
            />
          </section>
        </div>

        <aside className="rail" aria-labelledby="chart-heading">
          <h2 id="chart-heading">Where they sit</h2>
          <p className="rail-copy">{chartCopy}</p>
          <DistributionChart player={selected} rows={rows} />
        </aside>
      </main>
    </>
  );
}
