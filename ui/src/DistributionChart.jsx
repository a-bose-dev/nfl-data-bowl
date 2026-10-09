import { useEffect, useRef } from "react";
import Plotly from "plotly.js-basic-dist-min";
import { densityBins, formatYards } from "./metrics.js";

export default function DistributionChart({ player, expected }) {
  const mountRef = useRef(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount || !player || !expected) return undefined;

    const bins = densityBins(expected.percentiles || {});
    if (!bins.length) return undefined;

    const markerY = Math.max(...bins.map((bin) => bin.density));
    Plotly.react(
      mount,
      [
        {
          type: "bar",
          x: bins.map((bin) => bin.center),
          y: bins.map((bin) => bin.density),
          width: bins.map((bin) => bin.width),
          marker: { color: "#efe8e0", line: { color: "#141414", width: 1 } },
          hovertemplate: "%{customdata}<extra></extra>",
          customdata: bins.map(
            (bin) => `${bin.from}–${bin.to}th percentile<br>${formatYards(bin.x0, 2)}–${formatYards(bin.x1, 2)} yd`,
          ),
          name: "League plays",
        },
        {
          type: "scatter",
          mode: "markers",
          x: [player.mean],
          y: [markerY * 1.08],
          marker: { color: "#c8102e", size: 12, symbol: "diamond" },
          hovertemplate: `${player.name}<br>${formatYards(player.mean, 2)} yd<extra></extra>`,
          name: player.name,
        },
      ],
      {
        margin: { t: 28, r: 12, b: 48, l: 48 },
        paper_bgcolor: "rgba(0,0,0,0)",
        plot_bgcolor: "rgba(0,0,0,0)",
        showlegend: false,
        bargap: 0,
        xaxis: {
          title: { text: "Separation (yards)", font: { family: "Barlow, sans-serif", size: 13, color: "#3a3a3a" } },
          tickfont: { family: "Barlow, sans-serif", size: 12, color: "#141414" },
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
        shapes: [
          {
            type: "line",
            x0: expected.mean,
            x1: expected.mean,
            y0: 0,
            y1: 1,
            yref: "paper",
            line: { color: "#5c564f", width: 1.5, dash: "dash" },
          },
          {
            type: "line",
            x0: player.mean,
            x1: player.mean,
            y0: 0,
            y1: 1,
            yref: "paper",
            line: { color: "#c8102e", width: 2 },
          },
        ],
        annotations: [
          {
            x: expected.mean,
            y: 1,
            yref: "paper",
            yanchor: "bottom",
            text: "League",
            showarrow: false,
            font: { family: "Barlow, sans-serif", size: 11, color: "#5c564f" },
          },
        ],
      },
      { displayModeBar: false, responsive: true },
    );

    const resize = () => Plotly.Plots.resize(mount);
    window.addEventListener("resize", resize);
    return () => {
      window.removeEventListener("resize", resize);
      Plotly.purge(mount);
    };
  }, [player, expected]);

  if (!player || !expected) return null;
  if (!densityBins(expected.percentiles || {}).length) return null;
  return <div ref={mountRef} className="chart" />;
}
