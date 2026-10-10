"use client";

import { useEffect, useRef } from "react";
import {
  AreaSeries,
  ColorType,
  CrosshairMode,
  HistogramSeries,
  LineStyle,
  createChart,
  type IChartApi,
  type ISeriesApi,
  type SeriesType,
} from "lightweight-charts";

export type DailyPoint = { date: string; equity: number; pnl: number; trades: number };

const COLORS = {
  grid: "rgba(91,106,146,0.14)",
  text: "#8d9abd",
  line: "#2f7bff",
  profit: "#22c55e",
  loss: "#f43f5e",
  baseline: "#5b6a92",
};

function formatMoney(n: number, currency: string, signed = false) {
  const s = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency === "USDT" ? "USD" : currency,
    maximumFractionDigits: 2,
  }).format(Math.abs(n));
  return `${n < 0 ? "−" : signed && n > 0 ? "+" : ""}${s}`;
}

function useChart(
  build: (chart: IChartApi) => ISeriesApi<SeriesType>,
  tooltip: (time: string) => [string, string] | null,
  deps: unknown[],
) {
  const container = useRef<HTMLDivElement>(null);
  const tip = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = container.current;
    if (!el) return;
    const chart = createChart(el, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: COLORS.text,
        fontFamily: "var(--font-inter), system-ui, sans-serif",
        attributionLogo: false,
      },
      grid: { vertLines: { visible: false }, horzLines: { color: COLORS.grid } },
      rightPriceScale: { borderVisible: false },
      timeScale: { borderVisible: false, fixLeftEdge: true, fixRightEdge: true },
      crosshair: {
        mode: CrosshairMode.Magnet,
        vertLine: { color: COLORS.baseline, style: LineStyle.Solid, width: 1, labelVisible: false },
        horzLine: { visible: false, labelVisible: false },
      },
      handleScroll: false,
      handleScale: false,
    });
    build(chart);
    chart.timeScale().fitContent();

    chart.subscribeCrosshairMove((param) => {
      const t = tip.current;
      if (!t) return;
      const time = typeof param.time === "string" ? param.time : null;
      const content = time && param.point ? tooltip(time) : null;
      if (!content || !param.point) {
        t.style.display = "none";
        return;
      }
      // textContent only: values come from user data.
      const [value, label] = content;
      (t.children[0] as HTMLElement).textContent = value;
      (t.children[1] as HTMLElement).textContent = label;
      t.style.display = "block";
      const x = Math.min(Math.max(param.point.x + 12, 0), el.clientWidth - t.offsetWidth);
      t.style.transform = `translate(${x}px, 8px)`;
    });

    return () => chart.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { container, tip };
}

function Tooltip({ tipRef }: { tipRef: React.RefObject<HTMLDivElement | null> }) {
  return (
    <div
      ref={tipRef}
      className="pointer-events-none absolute left-0 top-0 z-10 hidden rounded-md border border-navy-600 bg-navy-950/95 px-2.5 py-1.5 shadow-lg"
    >
      <div className="num text-sm font-semibold text-white" />
      <div className="text-xs text-navy-300" />
    </div>
  );
}

const dateLabel = (d: string) =>
  new Date(`${d}T00:00:00Z`).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

export function EquityChart({ points, startBalance, currency }: { points: DailyPoint[]; startBalance: number; currency: string }) {
  const byDate = new Map(points.map((p) => [p.date, p]));
  const { container, tip } = useChart(
    (chart) => {
      const series = chart.addSeries(AreaSeries, {
        lineColor: COLORS.line,
        lineWidth: 2,
        topColor: "rgba(47,123,255,0.28)",
        bottomColor: "rgba(47,123,255,0.02)",
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerRadius: 4,
        crosshairMarkerBorderColor: "#0a1022",
        crosshairMarkerBorderWidth: 2,
        priceFormat: { type: "custom", formatter: (v: number) => formatMoney(v, currency) },
      });
      series.setData(points.map((p) => ({ time: p.date, value: p.equity })));
      series.createPriceLine({
        price: startBalance,
        color: COLORS.baseline,
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: false,
        title: "start",
      });
      return series;
    },
    (time) => {
      const p = byDate.get(time);
      return p ? [formatMoney(p.equity, currency), `${dateLabel(p.date)} · day ${formatMoney(p.pnl, currency, true)} · ${p.trades} trade${p.trades === 1 ? "" : "s"}`] : null;
    },
    [points, startBalance, currency],
  );

  return (
    <div className="relative h-72 w-full" role="img" aria-label="Equity curve: account balance at the end of each trading day">
      <div ref={container} className="absolute inset-0" />
      <Tooltip tipRef={tip} />
    </div>
  );
}

export function DailyPnlChart({ points, currency }: { points: DailyPoint[]; currency: string }) {
  const byDate = new Map(points.map((p) => [p.date, p]));
  const { container, tip } = useChart(
    (chart) => {
      const series = chart.addSeries(HistogramSeries, {
        priceLineVisible: false,
        lastValueVisible: false,
        base: 0,
        priceFormat: { type: "custom", formatter: (v: number) => formatMoney(v, currency, true) },
      });
      series.setData(points.map((p) => ({ time: p.date, value: p.pnl, color: p.pnl >= 0 ? COLORS.profit : COLORS.loss })));
      series.createPriceLine({ price: 0, color: COLORS.baseline, lineWidth: 1, lineStyle: LineStyle.Solid, axisLabelVisible: false });
      return series;
    },
    (time) => {
      const p = byDate.get(time);
      return p ? [formatMoney(p.pnl, currency, true), `${dateLabel(p.date)} · ${p.trades} trade${p.trades === 1 ? "" : "s"}`] : null;
    },
    [points, currency],
  );

  return (
    <div className="relative h-44 w-full" role="img" aria-label="Net profit or loss for each trading day">
      <div ref={container} className="absolute inset-0" />
      <Tooltip tipRef={tip} />
    </div>
  );
}
