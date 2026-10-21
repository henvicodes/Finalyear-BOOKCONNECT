import React, { useState, useRef, useLayoutEffect } from "react";
import { ArrowUpRight, ArrowDownRight, Minus, Table2, BarChart3 } from "lucide-react";
import { compact } from "./format";

// Small dependency-free SVG charts for the admin dashboard.
// Colours come from the --viz-* tokens in styles/admin.css (light + dark).

const longDay = (iso) => new Date(iso + "T00:00:00Z").toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });

// "Nice" axis maximum + ticks (0, step, 2*step ... max)
function niceScale(max, count = 4) {
  if (max <= 0) return { max: 1, ticks: [0, 1] };
  const raw = max / count;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) || raw;
  const top = Math.ceil(max / step) * step;
  const ticks = [];
  for (let v = 0; v <= top + 1e-9; v += step) ticks.push(v);
  return { max: top, ticks };
}

// width of a container, kept up to date on resize
function useWidth() {
  const ref = useRef(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    if (!ref.current) return undefined;
    setWidth(ref.current.clientWidth);
    const ro = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, width];
}

// ───────────── Sparkline ─────────────
export const Sparkline = ({ values, width = 96, height = 28 }) => {
  if (!values || values.length < 2) return null;
  const max = Math.max(...values, 1);
  const pts = values.map((v, i) => [(i / (values.length - 1)) * (width - 6) + 3, height - 4 - (v / max) * (height - 8)]);
  const last = pts[pts.length - 1];
  return (
    <svg width={width} height={height} role="img" aria-label="Trend over the period" className="viz-spark">
      <polyline points={pts.map((p) => p.join(",")).join(" ")} fill="none" stroke="var(--viz-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={last[0]} cy={last[1]} r="3" fill="var(--viz-s1)" stroke="var(--viz-surface)" strokeWidth="2" />
    </svg>
  );
};

// ───────────── Delta (change vs previous period) ─────────────
export const Delta = ({ change, upIsGood = true }) => {
  if (change === null || change === undefined) {
    return <span className="viz-delta flat"><Minus size={12} /> no earlier data</span>;
  }
  if (change === 0) return <span className="viz-delta flat"><Minus size={12} /> no change</span>;
  const up = change > 0;
  const good = up === upIsGood;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={`viz-delta ${good ? "good" : "bad"}`}>
      <Icon size={13} /> {up ? "+" : ""}{change}% <span className="viz-delta-note">vs previous</span>
    </span>
  );
};

// ───────────── Card wrapper with a chart/table switch ─────────────
export const ChartCard = ({ title, subtitle, legend, table, children, actions }) => {
  const [asTable, setAsTable] = useState(false);
  return (
    <section className="viz viz-card">
      <header className="viz-card-head">
        <div>
          <h3>{title}</h3>
          {subtitle && <p>{subtitle}</p>}
        </div>
        <div className="viz-card-tools">
          {actions}
          {table && (
            <button className="viz-toggle" onClick={() => setAsTable((t) => !t)} aria-pressed={asTable} title={asTable ? "Show chart" : "Show as table"}>
              {asTable ? <BarChart3 size={14} /> : <Table2 size={14} />}
              <span>{asTable ? "Chart" : "Table"}</span>
            </button>
          )}
        </div>
      </header>
      {legend}
      {asTable && table ? table : children}
    </section>
  );
};

export const Legend = ({ items }) => (
  <ul className="viz-legend">
    {items.map((it) => (
      <li key={it.key}>
        <span className="viz-swatch" style={{ background: it.color }} />
        {it.label}
      </li>
    ))}
  </ul>
);

// ───────────── Time chart: line+area (1 series) or stacked columns (2+) ─────────────
export const TimeChart = ({ data, series, height = 220, format = compact, kind }) => {
  const [ref, width] = useWidth();
  const [hover, setHover] = useState(null);
  const stacked = kind ? kind === "stack" : series.length > 1;
  const m = { top: 12, right: 12, bottom: 24, left: 40 };
  const w = Math.max(width, 240);
  const iw = w - m.left - m.right;
  const ih = height - m.top - m.bottom;

  const totals = data.map((d) => series.reduce((n, s) => n + (d[s.key] || 0), 0));
  const peak = stacked ? Math.max(...totals, 0) : Math.max(...data.map((d) => d[series[0].key] || 0), 0);
  const { max, ticks } = niceScale(peak);
  const y = (v) => m.top + ih - (v / max) * ih;
  const slot = iw / Math.max(data.length, 1);
  const x = (i) => m.left + (stacked ? slot * (i + 0.5) : (data.length === 1 ? iw / 2 : (i / (data.length - 1)) * iw));

  const everyNth = Math.max(1, Math.ceil(data.length / Math.max(2, Math.floor(iw / 70))));

  const onMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left - m.left;
    const i = stacked ? Math.floor(px / slot) : Math.round((px / iw) * (data.length - 1));
    setHover(Math.min(Math.max(i, 0), data.length - 1));
  };

  const barW = Math.min(24, Math.max(2, slot - 2));
  const topSegmentPath = (cx, yTop, h, r) => {
    const rad = Math.min(r, barW / 2, h);
    const x0 = cx - barW / 2;
    return `M${x0},${yTop + h} V${yTop + rad} Q${x0},${yTop} ${x0 + rad},${yTop} H${x0 + barW - rad} Q${x0 + barW},${yTop} ${x0 + barW},${yTop + rad} V${yTop + h} Z`;
  };

  const single = series[0];
  const linePts = data.map((d, i) => [x(i), y(d[single.key] || 0)]);
  const areaPath = linePts.length
    ? `M${linePts[0][0]},${y(0)} ${linePts.map((p) => `L${p[0]},${p[1]}`).join(" ")} L${linePts[linePts.length - 1][0]},${y(0)} Z`
    : "";
  const hovered = hover !== null ? data[hover] : null;

  return (
    <div className="viz-plot" ref={ref} style={{ height }}>
      {width > 0 && (
        <svg width={w} height={height} role="img" aria-label={series.map((s) => s.label).join(", ") + " over time"}
          onPointerMove={onMove} onPointerLeave={() => setHover(null)}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={m.left} x2={w - m.right} y1={y(t)} y2={y(t)} stroke={t === 0 ? "var(--viz-axis)" : "var(--viz-grid)"} strokeWidth="1" />
              <text x={m.left - 8} y={y(t) + 4} textAnchor="end" className="viz-tick">{format(t)}</text>
            </g>
          ))}
          {data.map((d, i) => (i % everyNth === 0 || i === data.length - 1) && (
            <text key={d.date} x={x(i)} y={height - 6} textAnchor={i === 0 ? "start" : i === data.length - 1 ? "end" : "middle"} className="viz-tick">
              {longDay(d.date)}
            </text>
          ))}

          {stacked ? (
            data.map((d, i) => {
              let acc = 0;
              const segs = series.map((s) => ({ s, v: d[s.key] || 0 })).filter((g) => g.v > 0);
              return (
                <g key={d.date} opacity={hover === null || hover === i ? 1 : 0.55}>
                  {segs.map((g, k) => {
                    const yTop = y(acc + g.v);
                    const h = Math.max(y(acc) - yTop - (k < segs.length - 1 || segs.length > 1 ? 2 : 0), 1);
                    acc += g.v;
                    const isTop = k === segs.length - 1;
                    return isTop
                      ? <path key={g.s.key} d={topSegmentPath(x(i), yTop, h, 4)} fill={g.s.color} />
                      : <rect key={g.s.key} x={x(i) - barW / 2} y={yTop} width={barW} height={h} fill={g.s.color} />;
                  })}
                </g>
              );
            })
          ) : (
            <>
              <path d={areaPath} fill={single.color} opacity="0.1" />
              <polyline points={linePts.map((p) => p.join(",")).join(" ")} fill="none" stroke={single.color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
              {linePts.length > 0 && (
                <circle cx={linePts[linePts.length - 1][0]} cy={linePts[linePts.length - 1][1]} r="4" fill={single.color} stroke="var(--viz-surface)" strokeWidth="2" />
              )}
            </>
          )}

          {hover !== null && (
            <>
              <line x1={x(hover)} x2={x(hover)} y1={m.top} y2={m.top + ih} stroke="var(--viz-axis)" strokeWidth="1" />
              {!stacked && <circle cx={x(hover)} cy={y(hovered[single.key] || 0)} r="4" fill={single.color} stroke="var(--viz-surface)" strokeWidth="2" />}
            </>
          )}
        </svg>
      )}
      {hovered && (
        <div className="viz-tip" style={{ left: Math.min(Math.max(x(hover), 70), w - 90), top: 4 }}>
          <div className="viz-tip-date">{longDay(hovered.date)}</div>
          {series.map((s) => (
            <div key={s.key} className="viz-tip-row">
              <i style={{ background: s.color }} />
              <strong>{format(hovered[s.key] || 0)}</strong>
              <span>{s.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// Accessible table twin of a time chart
export const TimeTable = ({ data, series, format = compact }) => (
  <div className="viz-table-wrap">
    <table className="admin-table">
      <thead><tr><th>Date</th>{series.map((s) => <th key={s.key}>{s.label}</th>)}</tr></thead>
      <tbody>
        {[...data].reverse().map((d) => (
          <tr key={d.date}><td>{longDay(d.date)}</td>{series.map((s) => <td key={s.key}>{format(d[s.key] || 0)}</td>)}</tr>
        ))}
      </tbody>
    </table>
  </div>
);

// ───────────── Horizontal bars (one series, one colour) ─────────────
export const HBars = ({ rows, format = compact, empty = "Nothing to show yet." }) => {
  if (!rows.length) return <p className="viz-empty">{empty}</p>;
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <ul className="viz-hbars">
      {rows.map((r) => (
        <li key={r.key || r.label} title={r.hint || ""}>
          <div className="viz-hbar-label">
            <span>{r.label}</span>
            {r.badge}
          </div>
          <div className="viz-hbar-track">
            <div className="viz-hbar-fill" style={{ width: `${Math.max((r.value / max) * 100, 1.5)}%` }} />
          </div>
          <strong className="viz-hbar-value">{format(r.value)}</strong>
        </li>
      ))}
    </ul>
  );
};

// ───────────── One stacked bar: share of a whole (≤ 6 parts) ─────────────
export const SegmentBar = ({ segments }) => {
  const total = segments.reduce((n, s) => n + s.value, 0) || 1;
  const [tip, setTip] = useState(null);
  return (
    <div>
      <div className="viz-segbar" onPointerLeave={() => setTip(null)}>
        {segments.filter((s) => s.value > 0).map((s) => (
          <div key={s.key} className="viz-seg" style={{ flex: s.value, background: s.color }}
            onPointerEnter={() => setTip(s)} tabIndex={0} onFocus={() => setTip(s)} onBlur={() => setTip(null)}
            aria-label={`${s.label}: ${s.value} (${Math.round((s.value / total) * 100)}%)`} />
        ))}
      </div>
      <div className="viz-segtip" aria-live="polite">
        {tip ? <><strong>{tip.value}</strong> {tip.label} · {Math.round((tip.value / total) * 100)}%</> : <span>Hover a segment</span>}
      </div>
      <Legend items={segments.map((s) => ({ key: s.key, label: `${s.label} (${s.value})`, color: s.color }))} />
    </div>
  );
};
