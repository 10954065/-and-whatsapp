"use client";

import { useState } from "react";

export interface DailyValue {
  /** Local calendar date, "YYYY-MM-DD". */
  date: string;
  value: number;
  /** Pre-formatted value for tooltip and table (e.g. money). */
  display: string;
}

const MAX_BAR_PX = 24;

/** Rounds up to 1, 2 or 5 × 10ⁿ so axis ticks are clean numbers. */
export function niceCeiling(value: number): number {
  if (value <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 5, 10].find((multiple) => multiple * magnitude >= value) ?? 10;
  return step * magnitude;
}

function compact(value: number): string {
  return new Intl.NumberFormat("en-GH", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

function dayLabel(date: string, style: "short" | "long"): string {
  const [year, month, day] = date.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", day: "numeric", month: "short", ...(style === "long" ? { weekday: "short", year: "numeric" } : {}) }).format(
    new Date(Date.UTC(year, month - 1, day)),
  );
}

/**
 * Single-series daily column chart: thin columns with rounded data-ends from one baseline,
 * hairline grid, per-column hover/focus tooltip and a table view with every value.
 */
export function DailyColumnChart({ title, data, valueLabel, emptyMessage }: { title: string; data: DailyValue[]; valueLabel: string; emptyMessage: string }) {
  const [active, setActive] = useState<number | null>(null);
  const max = niceCeiling(Math.max(...data.map((point) => point.value)));
  const hasData = data.some((point) => point.value > 0);
  const ticks = [max, max / 2, 0];
  const activePoint = active === null ? null : data[active];

  return (
    <figure className="rounded-2xl border bg-card p-5">
      <figcaption className="mb-4 flex items-baseline justify-between gap-3">
        <span className="font-semibold">{title}</span>
        <span className="text-xs text-muted-foreground">{data.length} days</span>
      </figcaption>
      {!hasData ? (
        <p className="py-10 text-center text-sm text-muted-foreground">{emptyMessage}</p>
      ) : (
        <div className="flex gap-2">
          <div className="flex h-40 flex-col justify-between text-right text-[11px] text-muted-foreground tabular-nums" aria-hidden="true">
            {ticks.map((tick) => (
              <span key={tick} className="leading-none">
                {compact(tick)}
              </span>
            ))}
          </div>
          <div className="relative min-w-0 flex-1">
            <div className="pointer-events-none absolute inset-x-0 top-0 flex h-40 flex-col justify-between" aria-hidden="true">
              {ticks.map((tick) => (
                <span key={tick} className="h-px w-full bg-border/70" />
              ))}
            </div>
            <div className="relative flex h-40 items-end gap-0.5" role="group" aria-label={title} onPointerLeave={() => setActive(null)}>
              {data.map((point, index) => (
                <button
                  key={point.date}
                  type="button"
                  aria-label={`${dayLabel(point.date, "long")}: ${point.display} ${valueLabel}`}
                  className="group flex h-full min-w-0 flex-1 items-end justify-center outline-none"
                  onPointerEnter={() => setActive(index)}
                  onFocus={() => setActive(index)}
                  onBlur={() => setActive(null)}
                >
                  <span
                    className="w-full rounded-t-[4px] bg-primary transition-[filter] group-hover:brightness-110 group-focus-visible:ring-2 group-focus-visible:ring-ring"
                    style={{ height: point.value > 0 ? `max(2px, ${(point.value / max) * 100}%)` : 0, maxWidth: MAX_BAR_PX }}
                  />
                </button>
              ))}
            </div>
            {activePoint && active !== null ? (
              <div
                className="pointer-events-none absolute -top-2 z-10 -translate-x-1/2 -translate-y-full rounded-lg border bg-popover px-2.5 py-1.5 text-xs whitespace-nowrap shadow-md"
                style={{ left: `${((active + 0.5) / data.length) * 100}%` }}
                role="status"
              >
                <p className="font-semibold text-foreground tabular-nums">
                  {activePoint.display} {valueLabel}
                </p>
                <p className="text-muted-foreground">{dayLabel(activePoint.date, "long")}</p>
              </div>
            ) : null}
            <div className="mt-1.5 flex justify-between text-[11px] text-muted-foreground" aria-hidden="true">
              <span>{dayLabel(data[0].date, "short")}</span>
              <span>{dayLabel(data[data.length - 1].date, "short")}</span>
            </div>
          </div>
        </div>
      )}
      <details className="mt-3 text-sm">
        <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">Show as table</summary>
        <div className="mt-2 max-h-56 overflow-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-muted-foreground">
                <th className="py-1 font-medium">Date</th>
                <th className="py-1 text-right font-medium capitalize">{valueLabel}</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {data.map((point) => (
                <tr key={point.date} className="border-t">
                  <td className="py-1">{dayLabel(point.date, "long")}</td>
                  <td className="py-1 text-right">{point.display}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
