import { useEffect, useRef } from "react";
import Plotly from "plotly.js-basic-dist-min";
import { formatCount, formatSigned, formatYards } from "./metrics.js";

function point(row) {
  return [
    row.nflId,
    row.name,
    formatCount(row.n),
    formatSigned(row.metric),
    formatYards(row.yardsPerRoute, 2),
  ];
}

function traces(rows, selectedId) {
  const rest = rows.filter((row) => row.nflId !== selectedId);
  const chosen = rows.find((row) => row.nflId === selectedId) || null;
  const series = [
    {
      type: "scatter",
      mode: "markers",
      x: rest.map((row) => row.metric),
      y: rest.map((row) => row.yardsPerRoute),
      customdata: rest.map(point),
      hovertemplate: "%{customdata[1]}<br>%{customdata[2]} snaps<br>%{customdata[3]} separation<br>%{customdata[4]} yd/route<extra></extra>",
      marker: {
        color: "#141414",
        size: 8,
        line: { color: "#fffcf8", width: 1 },
      },
      name: "Players",
    },
  ];
  if (chosen) {
    series.push({
      type: "scatter",
      mode: "markers+text",
      x: [chosen.metric],
      y: [chosen.yardsPerRoute],
      text: [chosen.name],
      textposition: "top center",
      textfont: { family: "Barlow, sans-serif", size: 13, color: "#8e0b20" },
      customdata: [point(chosen)],
      hovertemplate: "%{customdata[1]}<br>%{customdata[2]} snaps<br>%{customdata[3]} separation<br>%{customdata[4]} yd/route<extra></extra>",
      marker: {
        color: "#c8102e",
        size: 16,
        line: { color: "#141414", width: 1.5 },
      },
      cliponaxis: false,
      name: chosen.name,
    });
  }
  return series;
}

function layout(leagueYards) {
  return {
    margin: { t: 28, r: 16, b: 52, l: 56 },
    paper_bgcolor: "rgba(0,0,0,0)",
    plot_bgcolor: "rgba(0,0,0,0)",
    showlegend: false,
    hovermode: "closest",
    xaxis: {
      title: { text: "Separation above expected", font: { family: "Barlow, sans-serif", size: 13, color: "#3a3a3a" } },
      tickfont: { family: "Barlow, sans-serif", size: 12, color: "#141414" },
      zeroline: false,
      gridcolor: "#e4dfd8",
    },
    yaxis: {
      title: { text: "Yards per route", font: { family: "Barlow, sans-serif", size: 13, color: "#3a3a3a" } },
      tickfont: { family: "Barlow, sans-serif", size: 12, color: "#141414" },
      zeroline: false,
      gridcolor: "#e4dfd8",
    },
    shapes: [
      {
        type: "line",
        x0: 0,
        x1: 0,
        y0: 0,
        y1: 1,
        yref: "paper",
        line: { color: "#5c564f", width: 1.5, dash: "dash" },
      },
      {
        type: "line",
        y0: leagueYards,
        y1: leagueYards,
        x0: 0,
        x1: 1,
        xref: "paper",
        line: { color: "#5c564f", width: 1.5, dash: "dash" },
      },
    ],
  };
}

const config = { displayModeBar: false, responsive: true };

export default function QuadrantChart({ rows, leagueYards, selectedId, onSelect }) {
  const mountRef = useRef(null);
  const onSelectRef = useRef(onSelect);
  const selectedIdRef = useRef(selectedId);
  onSelectRef.current = onSelect;
  selectedIdRef.current = selectedId;

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount || !rows.length || leagueYards == null) return undefined;

    const select = (event) => {
      const nflId = event.points?.[0]?.customdata?.[0];
      if (nflId) onSelectRef.current(nflId);
    };
    Plotly.react(mount, traces(rows, selectedIdRef.current), layout(leagueYards), config);
    mount.on("plotly_hover", select);
    const resize = () => Plotly.Plots.resize(mount);
    window.addEventListener("resize", resize);
    return () => {
      window.removeEventListener("resize", resize);
      mount.removeListener("plotly_hover", select);
      Plotly.purge(mount);
    };
  }, [rows, leagueYards]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount || !rows.length || leagueYards == null) return;
    Plotly.react(mount, traces(rows, selectedId), layout(leagueYards), config);
  }, [rows, leagueYards, selectedId]);

  if (!rows.length || leagueYards == null) return null;
  return <div ref={mountRef} className="chart quadrant-chart" />;
}
