"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { man, yen } from "@/lib/format";
import type { DailyPoint } from "@/lib/finance-engine";
import type { TrendPoint } from "@/lib/view-model";

const AXIS = { fontSize: 11, fill: "var(--muted)" };
const GRID = "var(--line)";

interface TipProps {
  active?: boolean;
  label?: unknown;
  payload?: readonly { dataKey?: unknown; value?: unknown; name?: unknown; color?: string }[];
  labelFormatter?: (l: string) => string;
}

function TooltipBox({ active, payload, label, labelFormatter }: TipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-line bg-surface px-3 py-2 text-xs shadow-lg">
      <div className="mb-1 font-bold text-ink">{labelFormatter ? labelFormatter(String(label)) : String(label)}</div>
      {payload.map((p) =>
        p.value === null || p.value === undefined ? null : (
          <div key={String(p.dataKey)} className="flex items-center justify-between gap-4 text-soft">
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: p.color }} />
              {String(p.name)}
            </span>
            <span className="font-semibold tabular-nums text-ink">{yen(Number(p.value))}</span>
          </div>
        ),
      )}
    </div>
  );
}

export function MonthlySalesChart({ data, selected, onSelect }: { data: TrendPoint[]; selected: string; onSelect: (m: string) => void }) {
  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          barGap={2}
          margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
          onClick={(s) => {
            const idx = typeof s?.activeTooltipIndex === "number" ? s.activeTooltipIndex : Number(s?.activeTooltipIndex);
            if (Number.isFinite(idx) && data[idx]) onSelect(data[idx].month);
          }}
        >
          <CartesianGrid vertical={false} stroke={GRID} />
          <XAxis dataKey="short" tick={AXIS} tickLine={false} axisLine={{ stroke: GRID }} />
          <YAxis tick={AXIS} tickLine={false} axisLine={false} tickFormatter={man} width={56} />
          <Tooltip cursor={{ fill: "var(--subtle)" }} content={(p) => <TooltipBox active={p.active} label={p.label} payload={p.payload as TipProps["payload"]} labelFormatter={(l) => `${l}度`} />} />
          <Legend iconType="square" iconSize={10} wrapperStyle={{ fontSize: 12, color: "var(--soft)" }} />
          <Bar name="計画売上" dataKey="planSales" fill="var(--plan)" radius={[4, 4, 0, 0]} maxBarSize={22} />
          <Bar
            name="実績売上"
            dataKey="sales"
            fill="var(--brand)"
            radius={[4, 4, 0, 0]}
            maxBarSize={22}
            shape={(props: unknown) => {
              const p = props as { x: number; y: number; width: number; height: number; payload: TrendPoint };
              const isSel = p.payload.month === selected;
              if (!p.height) return <g />;
              const r = Math.min(4, p.width / 2);
              const { x, y, width: w, height: h } = p;
              return (
                <path
                  d={`M${x},${y + h} L${x},${y + r} Q${x},${y} ${x + r},${y} L${x + w - r},${y} Q${x + w},${y} ${x + w},${y + r} L${x + w},${y + h} Z`}
                  fill="var(--brand)"
                  opacity={isSel ? 1 : 0.72}
                  stroke={isSel ? "var(--ink)" : "none"}
                  strokeWidth={isSel ? 1.5 : 0}
                />
              );
            }}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function CumulativeOPChart({ data, target }: { data: TrendPoint[]; target?: { min: number; stretch: number } | null }) {
  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke={GRID} />
          <XAxis dataKey="short" tick={AXIS} tickLine={false} axisLine={{ stroke: GRID }} />
          <YAxis tick={AXIS} tickLine={false} axisLine={false} tickFormatter={man} width={60} />
          <Tooltip content={(p) => <TooltipBox active={p.active} label={p.label} payload={p.payload as TipProps["payload"]} labelFormatter={(l) => `${l}度 累計`} />} />
          <Legend iconType="plainline" wrapperStyle={{ fontSize: 12, color: "var(--soft)" }} />
          {target && (
            <ReferenceLine y={target.min} stroke="var(--good)" strokeDasharray="4 4" label={{ value: `年間目標 ${man(target.min)}`, position: "insideTopLeft", fontSize: 11, fill: "var(--good)" }} />
          )}
          <Line name="計画 累計営業利益" dataKey="cumPlanOP" stroke="var(--muted)" strokeWidth={2} strokeDasharray="5 4" dot={false} />
          <Line name="実績 累計営業利益" dataKey="cumOP" stroke="var(--brand)" strokeWidth={2} dot={{ r: 4, strokeWidth: 2, stroke: "var(--surface)" }} connectNulls={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function DailyCumulativeChart({ data, elapsed }: { data: DailyPoint[]; elapsed: number }) {
  const rows = data.map((d) => ({ ...d, cumulative: d.day <= Math.max(elapsed, 0) ? d.cumulative : null }));
  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={rows} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke={GRID} />
          <XAxis dataKey="day" tick={AXIS} tickLine={false} axisLine={{ stroke: GRID }} tickFormatter={(d) => `${d}日`} interval="preserveStartEnd" />
          <YAxis tick={AXIS} tickLine={false} axisLine={false} tickFormatter={man} width={60} />
          <Tooltip content={(p) => <TooltipBox active={p.active} label={p.label} payload={p.payload as TipProps["payload"]} labelFormatter={(l) => `${l}日時点`} />} />
          <Legend iconType="plainline" wrapperStyle={{ fontSize: 12, color: "var(--soft)" }} />
          <Line name="日割り計画ライン" dataKey="planLine" stroke="var(--muted)" strokeWidth={2} strokeDasharray="5 4" dot={false} />
          <Line name="累計実績" dataKey="cumulative" stroke="var(--brand)" strokeWidth={2} dot={false} connectNulls={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function DailyBarsChart({ data }: { data: DailyPoint[] }) {
  return (
    <div className="h-40">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke={GRID} />
          <XAxis dataKey="day" tick={AXIS} tickLine={false} axisLine={{ stroke: GRID }} interval="preserveStartEnd" tickFormatter={(d) => `${d}日`} />
          <YAxis tick={AXIS} tickLine={false} axisLine={false} tickFormatter={man} width={60} />
          <Tooltip cursor={{ fill: "var(--subtle)" }} content={(p) => <TooltipBox active={p.active} label={p.label} payload={p.payload as TipProps["payload"]} labelFormatter={(l) => `${l}日`} />} />
          <Bar name="当日計上売上" dataKey="daySales" fill="var(--brand)" radius={[4, 4, 0, 0]} maxBarSize={14} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
