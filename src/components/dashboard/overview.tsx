"use client";

import { AlertCircle, Target, TrendingUp, Wallet } from "lucide-react";
import { Badge, Card, CardHeader, RateBadge, StatCard, T } from "@/components/ui";
import { DEPT_META } from "@/lib/constants";
import { cn } from "@/lib/cn";
import { man, monthLabel, rate, yen } from "@/lib/format";
import type { Dept } from "@/lib/types";
import type { DashboardData } from "@/lib/view-model";
import { CumulativeOPChart } from "./charts";

export function OverviewTab({ data, onGoto }: { data: DashboardData; onGoto: (tab: string) => void }) {
  const pl = data.monthPL;
  if (!pl) return null;
  const t = pl.total;
  const margin = t.sales ? (t.op / t.sales) * 100 : 0;
  const planMargin = t.planSales ? (t.planOP / t.planSales) * 100 : 0;
  const scopeLabel = data.permissions.companyView ? "全社" : DEPT_META[data.scope[0]].label;

  return (
    <div className="space-y-6">
      {data.approvals.length + data.referralApprovals.length > 0 && (
        <button
          onClick={() => onGoto("approvals")}
          className="flex w-full items-center gap-2 rounded-xl border border-warn/40 bg-warn/10 px-4 py-3 text-left text-sm text-warn-ink hover:bg-warn/15"
        >
          <AlertCircle size={16} />
          <span className="font-bold">承認待ちの報告が {data.approvals.length + data.referralApprovals.length} 件あります。</span>
          <span className="text-xs">承認されるまでPL・インセンティブには反映されません →</span>
        </button>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label={`${scopeLabel} 売上高`}
          icon={<TrendingUp size={16} />}
          value={yen(t.sales)}
          footer={
            <div className="flex items-center justify-between">
              <span>計画 {yen(t.planSales)}</span>
              <RateBadge value={rate(t.sales, t.planSales)} />
            </div>
          }
        />
        <StatCard
          label="経費・原価合計"
          icon={<Wallet size={16} />}
          value={yen(t.totalCost)}
          valueClass="text-soft"
          footer={
            <div className="flex items-center justify-between">
              <span>計画枠 {yen(t.planCost)}</span>
              <Badge>消化 {rate(t.totalCost, t.planCost) ?? "—"}%</Badge>
            </div>
          }
        />
        <StatCard
          label="営業利益"
          icon={<Target size={16} />}
          value={yen(t.op)}
          valueClass={t.op >= 0 ? "text-good" : "text-bad"}
          footer={
            <div className="flex items-center justify-between">
              <span>計画 {yen(t.planOP)}</span>
              <RateBadge value={rate(t.op, t.planOP)} />
            </div>
          }
        />
        <StatCard
          label="営業利益率"
          value={`${margin.toFixed(1)}%`}
          footer={
            <div className="flex items-center justify-between">
              <span>計画 {planMargin.toFixed(1)}%</span>
              <span className={cn("font-bold", margin >= planMargin ? "text-good" : "text-bad")}>
                {margin >= planMargin ? "+" : ""}
                {(margin - planMargin).toFixed(1)}pt
              </span>
            </div>
          }
        />
      </div>

      {data.annualTarget && <AnnualTargetCard data={data} />}

      <Card>
        <CardHeader title={`事業部別 収支・達成率（${monthLabel(data.month)}）`} description="承認済みの実績のみ集計。リファーラル振替は紹介元へ配分後の数値です。" />
        <div className={T.wrap}>
          <table className={cn(T.table, "text-sm")}>
            <thead className={T.thead}>
              <tr>
                <th className={T.th}>事業部</th>
                <th className={cn(T.th, "text-right")}>売上実績</th>
                <th className={cn(T.th, "text-right")}>計画売上</th>
                <th className={cn(T.th, "text-center")}>売上進捗</th>
                <th className={cn(T.th, "text-right")}>経費・原価</th>
                <th className={cn(T.th, "text-right")}>営業利益</th>
                <th className={cn(T.th, "text-right")}>計画利益</th>
                <th className={cn(T.th, "text-center")}>利益達成率</th>
              </tr>
            </thead>
            <tbody className={T.tbody}>
              {data.scope.map((d: Dept) => {
                const r = pl.depts[d]!;
                if (d === "HQ" && !r.hasData && !r.fixedCost) return null;
                return (
                  <tr key={d} className={cn(T.tr, d !== "HQ" && "cursor-pointer")} onClick={() => d !== "HQ" && onGoto(d.toLowerCase())}>
                    <td className={T.td}>
                      <div className="flex items-center gap-2 font-bold text-ink">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ background: DEPT_META[d].color }} />
                        {DEPT_META[d].label}
                        {r.pendingCount > 0 && <Badge tone="warn">承認待ち {r.pendingCount}</Badge>}
                      </div>
                      <div className="ml-4.5 text-[11px] text-muted">
                        {DEPT_META[d].desc}
                        {d === "HR" && ` / 決定 ${r.placements}名`}
                      </div>
                    </td>
                    <td className={cn(T.num, "font-bold")}>{yen(r.sales)}</td>
                    <td className={cn(T.num, "text-muted")}>{yen(r.planSales)}</td>
                    <td className={cn(T.td, "text-center")}>
                      <RateBadge value={rate(r.sales, r.planSales)} />
                    </td>
                    <td className={cn(T.num, "text-soft")}>{yen(r.totalCost)}</td>
                    <td className={cn(T.num, "font-bold", r.op >= 0 ? "text-good" : "text-bad")}>{yen(r.op)}</td>
                    <td className={cn(T.num, "text-muted")}>{yen(r.planOP)}</td>
                    <td className={cn(T.td, "text-center")}>
                      <RateBadge value={rate(r.op, r.planOP)} />
                    </td>
                  </tr>
                );
              })}
              {data.scope.length > 1 && (
                <tr className="bg-subtle/70 font-black">
                  <td className={T.td}>全社合計</td>
                  <td className={cn(T.num, "text-brand")}>{yen(t.sales)}</td>
                  <td className={cn(T.num, "text-muted")}>{yen(t.planSales)}</td>
                  <td className={cn(T.td, "text-center")}>
                    <RateBadge value={rate(t.sales, t.planSales)} />
                  </td>
                  <td className={cn(T.num, "text-soft")}>{yen(t.totalCost)}</td>
                  <td className={cn(T.num, t.op >= 0 ? "text-good" : "text-bad")}>{yen(t.op)}</td>
                  <td className={cn(T.num, "text-muted")}>{yen(t.planOP)}</td>
                  <td className={cn(T.td, "text-center")}>
                    <RateBadge value={rate(t.op, t.planOP)} />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function AnnualTargetCard({ data }: { data: DashboardData }) {
  const target = data.annualTarget!;
  const actual = data.halves.H1.op + data.halves.H2.op;
  const forecast = data.halves.H1.forecastOP + data.halves.H2.forecastOP;
  const plan = data.halves.H1.planOP + data.halves.H2.planOP;
  const max = Math.max(target.stretch, forecast, plan) * 1.05;
  const pos = (v: number) => `${Math.max(0, Math.min(100, (v / max) * 100))}%`;
  return (
    <Card>
      <CardHeader title="第5期 年間営業利益 目標進捗" description={`年利 ${man(target.min)}〜${man(target.stretch)} 目標に対する累計実績と着地見込み（残り月は事業計画で補完）`} />
      <div className="grid gap-6 p-5 lg:grid-cols-[1fr_1.4fr]">
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3 text-xs">
            <div>
              <div className="text-muted">累計実績</div>
              <div className="text-xl font-black tabular-nums text-brand">{man(actual)}</div>
            </div>
            <div>
              <div className="text-muted">着地見込み</div>
              <div className={cn("text-xl font-black tabular-nums", forecast >= target.min ? "text-good" : "text-warn-ink")}>{man(forecast)}</div>
            </div>
            <div>
              <div className="text-muted">事業計画 合計</div>
              <div className="text-xl font-black tabular-nums text-soft">{man(plan)}</div>
            </div>
          </div>
          <div className="relative pt-7 pb-8">
            <div className="relative h-3 rounded-full bg-subtle">
              <div className="absolute inset-y-0 left-0 rounded-full bg-brand/30" style={{ width: pos(forecast) }} />
              <div className="absolute inset-y-0 left-0 rounded-full bg-brand" style={{ width: pos(actual) }} />
            </div>
            {[
              { v: target.min, l: "目標", top: true },
              { v: target.stretch, l: "ストレッチ", top: false },
            ].map((m) => (
              <div key={m.l} className={cn("absolute flex -translate-x-1/2 items-center", m.top ? "top-0 flex-col-reverse" : "top-4 flex-col")} style={{ left: pos(m.v) }}>
                <div className="h-5 w-0.5 bg-good" />
                <div className="whitespace-nowrap text-[10px] font-bold text-good">
                  {m.l} {man(m.v)}
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-soft">
            目標まで残り <span className="font-bold text-ink">{man(Math.max(0, target.min - actual))}</span>
            {forecast < target.min && (
              <>
                ／ 見込みベースで <span className="font-bold text-bad">{man(target.min - forecast)} 不足</span>
              </>
            )}
          </p>
        </div>
        <CumulativeOPChart data={data.trend} target={target} />
      </div>
    </Card>
  );
}
