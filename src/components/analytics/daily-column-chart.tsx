"use client";

import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface DailyValue {
  /** Local calendar date, "YYYY-MM-DD". */
  date: string;
  value: number;
  /** Pre-formatted value for tooltip and table (e.g. money). */
  display: string;
}

const MAX_BAR_PX = 24;
/** Up to a week, every column gets its weekday; longer ranges label only the ends. */
const LABEL_EVERY_DAY_UP_TO = 7;

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

function dayLabel(date: string, style: "short" | "long" | "weekday"): string {
  const [year, month, day] = date.split("-").map(Number);
  const options: Intl.DateTimeFormatOptions =
    style === "weekday" ? { weekday: "short" } : { day: "numeric", month: "short", ...(style === "long" ? { weekday: "short", year: "numeric" } : {}) };
  return new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", ...options }).format(new Date(Date.UTC(year, month - 1, day)));
}

/**
 * Single-series daily column chart: thin columns with rounded data-ends from one baseline,
 * hairline grid, per-column hover/focus tooltip and a table view with every value.
 * It grows to fill its grid cell, so side-by-side cards keep one height.
 */
export function DailyColumnChart({
  title,
  data,
  valueLabel,
  emptyMessage,
  summary,
}: {
  title: string;
  data: DailyValue[];
  valueLabel: string;
  emptyMessage: string;
  /** Optional headline figure under the title (e.g. the period total). */
  summary?: ReactNode;
}) {
  const [active, setActive] = useState<number | null>(null);
  const max = niceCeiling(Math.max(...data.map((point) => point.value)));
  const hasData = data.some((point) => point.value > 0);
  const ticks = [max, max / 2, 0];
  const activePoint = active === null ? null : data[active];
  const labelEveryDay = data.length <= LABEL_EVERY_DAY_UP_TO;

  return (
    <figure className="surface flex h-full flex-col rounded-[1.25rem] p-5">
      <figcaption className="mb-5">
        <span className="flex items-baseline justify-between gap-3">
          <span className="text-[15px] font-semibold tracking-[-0.01em]">{title}</span>
          <span className="text-xs text-muted-foreground">Last {data.length} days</span>
        </span>
        {summary ? <span className="mt-2 block">{summary}</span> : null}
      </figcaption>
      {!hasData ? (
        <p className="flex min-h-40 flex-1 items-center justify-center text-center text-sm text-muted-foreground">{emptyMessage}</p>
      ) : (
        <div className="flex min-h-44 flex-1 flex-col">
          <div className="flex flex-1 gap-2">
            <div className="flex w-7 flex-col justify-between text-right text-[11px] text-muted-foreground tabular-nums" aria-hidden="true">
              {ticks.map((tick) => (
                <span key={tick} className="leading-none">
                  {compact(tick)}
                </span>
              ))}
            </div>
            <div className="relative min-w-0 flex-1">
              <div className="pointer-events-none absolute inset-0 flex flex-col justify-between" aria-hidden="true">
                {ticks.map((tick) => (
                  <span key={tick} className="h-px w-full bg-border/70" />
                ))}
              </div>
              <div className="absolute inset-0 flex items-end gap-0.5" role="group" aria-label={title} onPointerLeave={() => setActive(null)}>
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
                      className="w-full rounded-t-[4px] bg-chart-1 transition-[filter] group-hover:brightness-110 group-focus-visible:ring-2 group-focus-visible:ring-ring"
                      style={{ height: point.value > 0 ? `max(2px, ${(point.value / max) * 100}%)` : 0, maxWidth: MAX_BAR_PX }}
                    />
                  </button>
                ))}
              </div>
              {activePoint && active !== null ? (
                <div
                  className="pointer-events-none absolute -top-2 z-10 -translate-x-1/2 -translate-y-full rounded-xl bg-popover px-2.5 py-1.5 text-xs whitespace-nowrap shadow-[var(--shadow-hairline),var(--shadow-lifted)]"
                  style={{ left: `${((active + 0.5) / data.length) * 100}%` }}
                  role="status"
                >
                  <p className="font-semibold text-foreground tabular-nums">
                    {activePoint.display} {valueLabel}
                  </p>
                  <p className="text-muted-foreground">{dayLabel(activePoint.date, "long")}</p>
                </div>
              ) : null}
            </div>
          </div>
          {labelEveryDay ? (
            <div className="mt-2 ml-9 flex gap-0.5 text-[11px] text-muted-foreground" aria-hidden="true">
              {data.map((point, index) => (
                <span key={point.date} className={cn("min-w-0 flex-1 text-center", index === data.length - 1 && "font-medium text-foreground")}>
                  {dayLabel(point.date, "weekday")}
                </span>
              ))}
            </div>
          ) : (
            <div className="mt-2 ml-9 flex justify-between text-[11px] text-muted-foreground" aria-hidden="true">
              <span>{dayLabel(data[0].date, "short")}</span>
              <span>{dayLabel(data[data.length - 1].date, "short")}</span>
            </div>
          )}
        </div>
      )}
      <details className="mt-4 text-sm">
        <summary className="cursor-pointer text-xs text-muted-foreground transition-colors hover:text-foreground">Show as table</summary>
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
