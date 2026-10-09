import { useEffect, useMemo, useRef } from "react";
import Plotly from "plotly.js-basic-dist-min";
import { centralMetrics, formatSigned, kdeCurve } from "./metrics.js";

export default function DistributionChart({ player, rows }) {
  const mountRef = useRef(null);
  const windowed = useMemo(() => centralMetrics((rows || []).map((row) => row.metric)), [rows]);
  const curve = useMemo(() => kdeCurve(windowed.values), [windowed]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount || !curve.length) return undefined;

    const markerY = Math.max(...curve.map((point) => point.y));
    const traces = [
      {
        type: "scatter",
        mode: "lines",
        x: curve.map((point) => point.x),
        y: curve.map((point) => point.y),
        line: { color: "#141414", width: 2.5, shape: "spline" },
        hovertemplate: "%{x:.2f} yd<br>density %{y:.2f}<extra></extra>",
        name: "Separation above expected",
      },
    ];
    const shapes = [
      {
        type: "line",
        x0: 0,
        x1: 0,
        y0: 0,
        y1: 1,
        yref: "paper",
        line: { color: "#5c564f", width: 1.5, dash: "dash" },
      },
    ];
    const annotations = [
      {
        x: 0,
        y: 1,
        yref: "paper",
        yanchor: "bottom",
        text: "League",
        showarrow: false,
        font: { family: "Barlow, sans-serif", size: 11, color: "#5c564f" },
      },
    ];
    const inWindow = player && Number.isFinite(player.metric) && player.metric >= windowed.low && player.metric <= windowed.high;
    if (inWindow) {
      traces.push({
        type: "scatter",
        mode: "markers",
        x: [player.metric],
        y: [markerY * 1.08],
        marker: { color: "#c8102e", size: 12, symbol: "diamond" },
        hovertemplate: `${player.name}<br>${formatSigned(player.metric)}<extra></extra>`,
        name: player.name,
      });
      shapes.push({
        type: "line",
        x0: player.metric,
        x1: player.metric,
        y0: 0,
        y1: 1,
        yref: "paper",
        line: { color: "#c8102e", width: 2 },
      });
    }
    Plotly.react(
      mount,
      traces,
      {
        margin: { t: 28, r: 12, b: 48, l: 48 },
        paper_bgcolor: "rgba(0,0,0,0)",
        plot_bgcolor: "rgba(0,0,0,0)",
        showlegend: false,
        xaxis: {
          title: { text: "Separation above expected (yards)", font: { family: "Barlow, sans-serif", size: 13, color: "#3a3a3a" } },
          tickfont: { family: "Barlow, sans-serif", size: 12, color: "#141414" },
          range: [windowed.low, windowed.high],
          zeroline: false,
          gridcolor: "#e4dfd8",
        },
        yaxis: {
          title: { text: "Density", font: { family: "Barlow, sans-serif", size: 13, color: "#3a3a3a" } },
          tickfont: { family: "Barlow, sans-serif", size: 12, color: "#141414" },
          showticklabels: false,
          zeroline: false,
          gridcolor: "rgba(0,0,0,0)",
          range: [0, markerY * 1.28],
        },
        shapes,
        annotations,
      },
      { displayModeBar: false, responsive: true },
    );

    const resize = () => Plotly.Plots.resize(mount);
    window.addEventListener("resize", resize);
    return () => {
      window.removeEventListener("resize", resize);
      Plotly.purge(mount);
    };
  }, [player, curve, windowed]);

  if (!curve.length) return null;
  return <div ref={mountRef} className="chart" />;
}
