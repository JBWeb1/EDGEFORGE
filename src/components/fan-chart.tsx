"use client";

import { useState } from "react";

export type Band = { step: number; p5: number; p25: number; p50: number; p75: number; p95: number };

const W = 720;
const H = 300;
const PAD = { l: 64, r: 16, t: 12, b: 28 };

/**
 * Fan chart of simulated outcomes: 5–95% and 25–75% bands around the median,
 * with a hover readout of all three at the nearest trade number.
 */
export function FanChart({ bands, format, unitLabel }: { bands: Band[]; format: (n: number) => string; unitLabel: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const maxStep = bands[bands.length - 1].step;
  const lo = Math.min(0, ...bands.map((b) => b.p5));
  const hi = Math.max(0, ...bands.map((b) => b.p95));
  const span = hi - lo || 1;
  const x = (s: number) => PAD.l + (s / maxStep) * (W - PAD.l - PAD.r);
  const y = (v: number) => PAD.t + (1 - (v - lo) / span) * (H - PAD.t - PAD.b);
  const area = (top: keyof Band, bottom: keyof Band) =>
    `M${bands.map((b) => `${x(b.step)},${y(b[top])}`).join("L")}L${[...bands].reverse().map((b) => `${x(b.step)},${y(b[bottom])}`).join("L")}Z`;
  const median = `M${bands.map((b) => `${x(b.step)},${y(b.p50)}`).join("L")}`;
  const ticks = [lo, lo + span / 2, hi];
  const h = hover === null ? null : bands[hover];

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full touch-none select-none"
        role="img"
        aria-label={`Simulated ${unitLabel} over the next ${maxStep} trades: median and 5th to 95th percentile range`}
        onPointerMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const px = ((e.clientX - rect.left) / rect.width) * W;
          const step = ((px - PAD.l) / (W - PAD.l - PAD.r)) * maxStep;
          let best = 0;
          bands.forEach((b, i) => {
            if (Math.abs(b.step - step) < Math.abs(bands[best].step - step)) best = i;
          });
          setHover(best);
        }}
        onPointerLeave={() => setHover(null)}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(t)} y2={y(t)} stroke="rgba(91,106,146,0.18)" />
            <text x={PAD.l - 8} y={y(t)} textAnchor="end" dominantBaseline="middle" className="fill-navy-400 text-[11px]">{format(t)}</text>
          </g>
        ))}
        <line x1={PAD.l} x2={W - PAD.r} y1={y(0)} y2={y(0)} stroke="#5b6a92" strokeDasharray="4 4" />
        <path d={area("p95", "p5")} fill="rgba(47,123,255,0.14)" />
        <path d={area("p75", "p25")} fill="rgba(47,123,255,0.28)" />
        <path d={median} fill="none" stroke="#2f7bff" strokeWidth="2" />
        <text x={PAD.l} y={H - 8} className="fill-navy-400 text-[11px]">0</text>
        <text x={W - PAD.r} y={H - 8} textAnchor="end" className="fill-navy-400 text-[11px]">{maxStep} trades</text>
        {h && (
          <g>
            <line x1={x(h.step)} x2={x(h.step)} y1={PAD.t} y2={H - PAD.b} stroke="#5b6a92" />
            <circle cx={x(h.step)} cy={y(h.p50)} r="4" fill="#2f7bff" stroke="#0a1022" strokeWidth="2" />
          </g>
        )}
      </svg>
      {h && (
        <div
          className="pointer-events-none absolute top-2 rounded-md border border-navy-600 bg-navy-950/95 px-2.5 py-1.5 text-xs shadow-lg"
          style={{ left: `${Math.min(70, (x(h.step) / W) * 100)}%` }}
        >
          <div className="num text-sm font-semibold text-white">{format(h.p50)}</div>
          <div className="text-navy-300">median after trade {h.step}</div>
          <div className="num mt-1 text-navy-300">50%: {format(h.p25)} to {format(h.p75)}</div>
          <div className="num text-navy-300">90%: {format(h.p5)} to {format(h.p95)}</div>
        </div>
      )}
      <div className="mt-2 flex flex-wrap gap-4 text-xs text-navy-300">
        <span className="inline-flex items-center gap-1.5"><span className="h-0.5 w-4 bg-electric" />Median</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-3 w-4 rounded-sm bg-electric/30" />Middle 50% of outcomes</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-3 w-4 rounded-sm bg-electric/15" />90% of outcomes</span>
      </div>
    </div>
  );
}
