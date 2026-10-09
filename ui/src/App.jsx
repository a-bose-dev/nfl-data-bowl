import { useMemo, useState } from "react";
import coverageData from "../../metric_data/separation_by_coverage.json";
import playerData from "../../metric_data/separation_by_player.json";
import DistributionChart from "./DistributionChart.jsx";
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
} from "./metrics.js";

const coverages = coveragesFor(coverageData);

function keepOrFirst(options, current) {
  return options.includes(current) ? current : options[0] || "";
}

export default function App() {
  const [coverage, setCoverage] = useState("man");
  const [alignment, setAlignment] = useState("wide");
  const [formation, setFormation] = useState("11");
  const [minSnapsText, setMinSnapsText] = useState("5");
  const [selectedId, setSelectedId] = useState(null);

  const alignments = alignmentsFor(coverageData, coverage);
  const formations = formationsFor(coverageData, coverage, alignment);
  const minSnaps = Number.parseInt(minSnapsText, 10);
  const activeMin = Number.isFinite(minSnaps) && minSnaps >= 1 ? minSnaps : null;

  const expected = cellFor(coverageData, coverage, alignment, formation);
  const rows = useMemo(() => {
    if (activeMin == null) return [];
    return qualifiedPlayers(coverageData, playerData, coverage, alignment, formation, activeMin);
  }, [coverage, alignment, formation, activeMin]);

  const selected = rows.find((row) => row.nflId === selectedId) || null;

  function chooseCoverage(next) {
    const nextAlignments = alignmentsFor(coverageData, next);
    const nextAlignment = keepOrFirst(nextAlignments, alignment);
    const nextFormations = formationsFor(coverageData, next, nextAlignment);
    setCoverage(next);
    setAlignment(nextAlignment);
    setFormation(keepOrFirst(nextFormations, formation));
  }

  function chooseAlignment(next) {
    const nextFormations = formationsFor(coverageData, coverage, next);
    setAlignment(next);
    setFormation(keepOrFirst(nextFormations, formation));
  }

  const status =
    activeMin == null
      ? ""
      : rows.length === 1
        ? "1 player at or above the snap minimum."
        : `${formatCount(rows.length)} players at or above the snap minimum.`;

  const meta =
    expected && expected.mean != null
      ? `${formatCount(expected.n)} plays in ${labelCoverage(coverage).toLowerCase()} coverage, ${labelAlignment(alignment).toLowerCase()} alignment, ${labelFormation(formation)}.`
      : "This configuration has no league sample.";

  let chartCopy = "Select a player to place their mean on the league distribution for this configuration.";
  if (selected && expected?.mean != null) {
    chartCopy = `${selected.name} averages ${formatYards(selected.mean, 2)} yards. The league average in this configuration is ${formatYards(expected.mean, 2)}.`;
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
            <select value={formation} onChange={(event) => setFormation(event.target.value)}>
              {formations.map((code) => (
                <option key={code} value={code}>{labelFormation(code)}</option>
              ))}
            </select>
          </label>
          <label>
            Minimum snaps
            <input
              type="number"
              min="1"
              step="1"
              inputMode="numeric"
              value={minSnapsText}
              onChange={(event) => setMinSnapsText(event.target.value)}
              onBlur={() => {
                const parsed = Number.parseInt(minSnapsText, 10);
                if (!Number.isFinite(parsed) || parsed < 1) setMinSnapsText("5");
              }}
            />
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
                        {activeMin == null
                          ? "Enter a snap minimum of at least 1."
                          : "No players have this many snaps in the selected configuration. Lower the minimum to widen the list."}
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
                          aria-pressed={selectedRow}
                          onClick={() => setSelectedId(row.nflId)}
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

          <aside className="rail" aria-labelledby="chart-heading">
            <h2 id="chart-heading">Where they sit</h2>
            <p className="rail-copy">{chartCopy}</p>
            <DistributionChart player={selected} expected={expected} />
          </aside>
        </div>
      </main>
    </>
  );
}
