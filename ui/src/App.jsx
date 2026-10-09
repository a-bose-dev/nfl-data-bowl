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
  const [search, setSearch] = useState("");
  const [guide, setGuide] = useState(null);
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

  const query = search.trim().toLowerCase();
  const visible = useMemo(() => {
    if (!query) return rows;
    return rows.filter((row) => row.name.toLowerCase().includes(query));
  }, [rows, query]);

  const selected = visible.find((row) => row.nflId === selectedId) || null;

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

  let status = rows.length === 1
    ? "1 player at or above the snap minimum."
    : `${formatCount(rows.length)} players at or above the snap minimum.`;
  if (rows.length === 0) {
    status = "No players at or above the snap minimum.";
  } else if (query) {
    status = visible.length === 1
      ? "1 player matches the search."
      : `${formatCount(visible.length)} players match the search.`;
  }

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
          <h1>Who gets open?</h1>
          <p className="lede">Yards of separation above the average for this coverage, alignment, and formation.</p>
        </div>
      </header>

      <main className="page">
        <section className="guide" aria-label="About this tool">
          <div className="guide-tabs" role="tablist">
            <button
              type="button"
              role="tab"
              id="guide-purpose-tab"
              aria-selected={guide === "purpose"}
              aria-controls="guide-panel"
              onClick={() => setGuide(guide === "purpose" ? null : "purpose")}
            >
              What it's for
            </button>
            <button
              type="button"
              role="tab"
              id="guide-navigate-tab"
              aria-selected={guide === "navigate"}
              aria-controls="guide-panel"
              onClick={() => setGuide(guide === "navigate" ? null : "navigate")}
            >
              How to use
            </button>
          </div>
          {guide ? (
            <div
              className="guide-panel"
              role="tabpanel"
              id="guide-panel"
              aria-labelledby={guide === "purpose" ? "guide-purpose-tab" : "guide-navigate-tab"}
            >
              {guide === "purpose" ? (
                <>
                  <p>
                    Separation above expected is how much more or less space a receiver creates at pass release than a typical receiver against the same coverage and from the same alignment. Players are judged against the situation they actually faced.
                  </p>
                  <p>
                    The measure uses NFL Next Gen Stats tracking and PFF coverage and scouting data from weeks 1–8 of 2021. Each receiver's separation above expected is plotted against yards per route run. The four groups are receivers who create space and produce, create space but lack the yardage, produce without space, or do neither.
                  </p>
                  <p>
                    Coaches can see who could separate more, or produce more from the space they already get. Fans and broadcasters can use it to explain a route. Scouts can use it to look for the next great route runner.
                  </p>
                </>
              ) : (
                <ul>
                  <li>Coverage, alignment, and formation set the situation. All is the default for each.</li>
                  <li>Minimum snaps starts at the average snap count for that situation. Drag it to widen or narrow the list.</li>
                  <li>Search filters the list by name. The rank stays the player's place in the full list.</li>
                  <li>The metric is yards of separation above the league average for the situation you selected.</li>
                  <li>Hover a row to mark that player on the scatter plot and on the density curve.</li>
                  <li>The scatter plot is separation above expected against yards per route. The crosshairs are the league averages, and the four corners are the four groups.</li>
                  <li>The curve shows where the group sits, from the 1st through the 99th percentile.</li>
                </ul>
              )}
            </div>
          ) : null}
        </section>

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
              <label className="player-search">
                Search
                <input
                  type="search"
                  value={search}
                  placeholder="Player name"
                  onChange={(event) => setSearch(event.target.value)}
                />
              </label>
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
                  {visible.length === 0 ? (
                    <tr>
                      <td className="empty-cell" colSpan={5}>
                        {rows.length === 0
                          ? "No players have this many snaps in the selected configuration. Lower the minimum to widen the list."
                          : "No players match that search."}
                      </td>
                    </tr>
                  ) : (
                    visible.map((row) => {
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
                          <td className="rank">{rows.indexOf(row) + 1}</td>
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
