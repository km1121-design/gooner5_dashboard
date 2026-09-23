"use client";

import { Badge, Card, CardHeader, Progress, RateBadge, T } from "@/components/ui";
import { HALF_LABEL, type Half } from "@/lib/constants";
import { cn } from "@/lib/cn";
import { monthLabel, rate, signedYen, yen } from "@/lib/format";
import type { DashboardData } from "@/lib/view-model";
import { CumulativeOPChart, DailyBarsChart, DailyCumulativeChart, MonthlySalesChart } from "./charts";

export function TrendTab({ data, onSelectMonth, onOpenMonth }: { data: DashboardData; onSelectMonth: (m: string) => void; onOpenMonth: (m: string) => void }) {
  const annualPlanSales = data.halves.H1.planSales + data.halves.H2.planSales;
  const annualPlanOP = data.halves.H1.planOP + data.halves.H2.planOP;
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="p-5">
          <div className="text-xs font-semibold text-muted">第5期 年間計画</div>
          <div className="mt-1 text-2xl font-black tabular-nums">{yen(annualPlanSales)}</div>
          <div className="mt-3 flex justify-between border-t border-line pt-2 text-xs text-soft">
            <span>計画 通年営業利益</span>
            <span className="font-bold text-good">{yen(annualPlanOP)}</span>
          </div>
        </Card>
        {(["H1", "H2"] as Half[]).map((h) => {
          const x = data.halves[h];
          return (
            <Card key={h} className="p-5">
              <div className="flex items-center justify-between text-xs font-semibold text-muted">
                <span>{HALF_LABEL[h]} 売上実績</span>
                <Badge tone={h === "H1" ? "brand" : "violet"}>ボーナス清算 {h === "H1" ? "2027年2月" : "2027年8月"}</Badge>
              </div>
              <div className="mt-1 text-2xl font-black tabular-nums">{yen(x.sales)}</div>
              <div className="mt-3 space-y-1 border-t border-line pt-2 text-xs text-soft">
                <div className="flex justify-between">
                  <span>計画売上 {yen(x.planSales)}</span>
                  <RateBadge value={x.sales ? rate(x.sales, x.planSales) : null} />
                </div>
                <div className="flex justify-between">
                  <span>営業利益 実績 / 見込み</span>
                  <span className="font-bold tabular-nums">
                    <span className={x.op >= 0 ? "text-good" : "text-bad"}>{yen(x.op)}</span> / {yen(x.forecastOP)}
                  </span>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader title="月次 売上推移（計画 vs 実績）" description="棒をクリックするとその月に切り替わります" />
          <div className="p-4">
            <MonthlySalesChart data={data.trend} selected={data.month} onSelect={onSelectMonth} />
          </div>
        </Card>
        <Card>
          <CardHeader title="累計 営業利益推移" description="計画累計（破線）と実績累計の乖離" />
          <div className="p-4">
            <CumulativeOPChart data={data.trend} target={data.annualTarget} />
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader title="12ヶ月 予実テーブル" description="行をクリックするとその月のPL概要を開きます" />
        <div className={T.wrap}>
          <table className={T.table}>
            <thead className={T.thead}>
              <tr>
                <th className={T.th}>月度</th>
                <th className={T.th}>期</th>
                <th className={cn(T.th, "text-right")}>売上実績</th>
                <th className={cn(T.th, "text-right")}>計画売上</th>
                <th className={cn(T.th, "text-center")}>進捗率</th>
                <th className={cn(T.th, "text-right")}>営業利益</th>
                <th className={cn(T.th, "text-right")}>計画利益</th>
                <th className={cn(T.th, "text-right")}>利益差異</th>
              </tr>
            </thead>
            <tbody className={T.tbody}>
              {data.trend.map((m) => (
                <tr key={m.month} className={cn(T.tr, "cursor-pointer", m.month === data.month && "bg-brand/5 font-semibold")} onClick={() => onOpenMonth(m.month)}>
                  <td className={cn(T.td, "font-bold")}>
                    {m.month === data.month && <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-brand" />}
                    {monthLabel(m.month)}
                  </td>
                  <td className={T.td}>
                    <Badge tone={m.half === "H1" ? "brand" : "violet"}>{m.half === "H1" ? "上期" : "下期"}</Badge>
                  </td>
                  <td className={cn(T.num, "font-bold")}>{m.sales === null ? <span className="text-faint">—</span> : yen(m.sales)}</td>
                  <td className={cn(T.num, "text-muted")}>{yen(m.planSales)}</td>
                  <td className={cn(T.td, "text-center")}>
                    <RateBadge value={m.sales === null ? null : rate(m.sales, m.planSales)} />
                  </td>
                  <td className={cn(T.num, "font-bold", (m.op ?? 0) >= 0 ? "text-good" : "text-bad")}>{m.op === null ? <span className="text-faint">—</span> : yen(m.op)}</td>
                  <td className={cn(T.num, "text-muted")}>{yen(m.planOP)}</td>
                  <td className={cn(T.num, "font-bold", m.op !== null && m.op - m.planOP >= 0 ? "text-good" : "text-bad")}>
                    {m.op === null ? <span className="text-faint">—</span> : signedYen(m.op - m.planOP)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

export function DailyTab({ data }: { data: DashboardData }) {
  const { points, elapsed, days } = data.daily;
  const sales = points.at(-1)?.cumulative ?? 0;
  const plan = data.monthPL?.total.planSales ?? 0;
  const runRate = elapsed > 0 ? (sales / elapsed) * days : 0;
  const paceRate = rate(runRate, plan);
  const status = elapsed === 0 ? "未開始" : elapsed >= days ? "月次確定" : `${elapsed}日経過 / ${days}日`;
  const shown = points.filter((p) => p.day <= Math.max(elapsed, 0));

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="text-xs font-bold text-brand">
              {monthLabel(data.month)} 着地予測（ランレート） <Badge className="ml-1">{status}</Badge>
            </div>
            <div className="mt-1 text-2xl font-black tabular-nums sm:text-3xl">着地見込み売上 {elapsed ? yen(runRate) : "—"}</div>
            <p className="mt-1 text-xs text-muted">
              累計売上（直接計上）{yen(sales)} ／ 月間計画 {yen(plan)}。※リファーラル振替・経費は含まない日次ベース
            </p>
          </div>
          <div className="text-right">
            <div className={cn("text-3xl font-black tabular-nums", (paceRate ?? 0) >= 100 ? "text-good" : "text-warn-ink")}>{elapsed ? `${paceRate ?? "—"}%` : "—"}</div>
            <div className="text-xs text-muted">計画比 着地ペース</div>
          </div>
        </div>
        <Progress className="mt-4 h-3" value={plan ? (sales / plan) * 100 : 0} />
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader title="累計売上 vs 日割り計画" />
          <div className="p-4">
            <DailyCumulativeChart data={points} elapsed={elapsed} />
          </div>
        </Card>
        <Card>
          <CardHeader title="日次 計上売上" />
          <div className="p-4">
            <DailyBarsChart data={points} />
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader title={`日次実績明細（${monthLabel(data.month)}）`} />
        <div className={cn(T.wrap, "max-h-96")}>
          <table className={T.table}>
            <thead className={cn(T.thead, "sticky top-0")}>
              <tr>
                <th className={T.th}>日付</th>
                <th className={cn(T.th, "text-right")}>当日計上</th>
                <th className={cn(T.th, "text-right")}>累計実績</th>
                <th className={cn(T.th, "text-right")}>日割り計画</th>
                <th className={cn(T.th, "text-right")}>計画乖離</th>
              </tr>
            </thead>
            <tbody className={T.tbody}>
              {shown.map((d) => (
                <tr key={d.day} className={T.tr}>
                  <td className={T.td}>{d.day}日</td>
                  <td className={cn(T.num, "font-semibold")}>{d.daySales ? yen(d.daySales) : <span className="text-faint">—</span>}</td>
                  <td className={cn(T.num, "font-bold text-brand")}>{yen(d.cumulative)}</td>
                  <td className={cn(T.num, "text-muted")}>{yen(d.planLine)}</td>
                  <td className={cn(T.num, "font-bold", d.cumulative - d.planLine >= 0 ? "text-good" : "text-bad")}>{signedYen(d.cumulative - d.planLine)}</td>
                </tr>
              ))}
              {!shown.length && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-muted">
                    この月はまだ始まっていません
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
