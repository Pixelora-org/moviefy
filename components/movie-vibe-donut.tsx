"use client";

import type { VibeSlice } from "@/lib/movie-vibe-chart";

export function MovieVibeDonut({
  slices,
  centerLine,
  subLine,
}: {
  slices: VibeSlice[];
  centerLine: string;
  subLine?: string;
}) {
  if (!slices.length) return null;
  const parts = slices.reduce<{ stops: string[]; total: number }>(
    ({ stops, total }, slice) => {
      const end = total + slice.pct;
      return {
        stops: [...stops, `${slice.color} ${total}% ${end}%`],
        total: end,
      };
    },
    { stops: [], total: 0 },
  ).stops;
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-5">
      <div className="relative mx-auto size-[7.5rem] shrink-0 sm:mx-0">
        <div
          className="absolute inset-0 rounded-full"
          style={{ background: `conic-gradient(${parts.join(",")})` }}
        />
        <div className="absolute inset-[22%] flex flex-col items-center justify-center rounded-full bg-card px-1 text-center">
          <span className="text-[11px] font-semibold leading-tight text-white/90">
            {centerLine}
          </span>
          {subLine ? (
            <span className="mt-0.5 text-[9px] leading-tight text-white/45">{subLine}</span>
          ) : null}
        </div>
      </div>
      <ul className="min-w-0 flex-1 space-y-1.5 text-[11px]">
        {slices.map((s) => (
          <li key={s.name} className="flex items-center gap-2 text-white/75">
            <span
              className="size-2 shrink-0 rounded-full"
              style={{ backgroundColor: s.color }}
            />
            <span className="min-w-0 truncate">{s.name}</span>
            <span className="ml-auto tabular-nums text-white/50">{s.pct}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
