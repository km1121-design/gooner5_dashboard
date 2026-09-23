"use client";

import { ArrowRightLeft, Plus, Receipt } from "lucide-react";
import { Badge, Button, Card, CardHeader, Empty, Progress, RateBadge, StatCard, T } from "@/components/ui";
import { DEPT_META } from "@/lib/constants";
import { cn } from "@/lib/cn";
import { monthLabel, payTiming, rate, yen } from "@/lib/format";
import type { BusinessDept } from "@/lib/types";
import type { DashboardData } from "@/lib/view-model";
import { memberName, StatusBadge, TxTable } from "./shared";

const pct = (r: number) => `${Math.round(r * 1000) / 10}%`;

export function DeptTab({
  data,
  dept,
  onAddExpense,
  onAddReferral,
}: {
  data: DashboardData;
  dept: BusinessDept;
  onAddExpense: () => void;
  onAddReferral: () => void;
}) {
  const pl = data.monthPL?.depts[dept];
  if (!pl) return <Empty>この事業部を閲覧する権限がありません</Empty>;
  const meta = DEPT_META[dept];
  const R = data.rules;
  const tx = data.transactions.filter((t) => t.department === dept);
  const refs = data.referrals.filter((r) => r.to_dept === dept || data.members.find((m) => m.member_id === r.from_member_id)?.department === dept);
  const exps = data.expenses.filter((e) => e.department === dept);
  const leaderSummary = data.summaries.find((s) => s.member.department === dept && s.member.role === "LEADER");
  // 決定手当は明細表に表示するため、ここでは事業部インセンのみ
  const leaderItems = leaderSummary?.earnedThisMonth.filter((i) => i.kind !== "HR_PLACEMENT") ?? [];
  const canAddExpense = data.me.role === "ADMIN" || (data.me.role === "LEADER" && data.me.department === dept);

  let special: React.ReactNode = null;
  if (dept === "SALES") {
    const threshold = R.sales_bar_inc_threshold;
    const fired = pl.op >= threshold;
    special = (
      <StatCard
        label={`BARインセン（${payTiming(R.sales_bar_pay_offset)}支給）`}
        value={yen(fired ? pl.barSales * R.sales_bar_inc_rate : 0)}
        valueClass={fired ? "text-warn-ink" : "text-faint"}
        footer={
          <div className="space-y-1.5">
            <div className="flex justify-between">
              <span>発動条件 利益 {yen(threshold)}</span>
              <Badge tone={fired ? "good" : "neutral"}>{fired ? "発動" : `あと ${yen(threshold - pl.op)}`}</Badge>
            </div>
            <Progress value={(pl.op / threshold) * 100} color="var(--warn)" />
          </div>
        }
      />
    );
  } else if (dept === "HR") {
    special = (
      <StatCard
        label="入社決定数"
        value={`${pl.placements}名`}
        valueClass="text-brand"
        footer={`マスターキー ${pct(R.hr_masterkey_rate)}: ${yen(pl.masterKeyFee)}`}
      />
    );
  } else {
    special = (
      <StatCard
        label={`運送統括 ${pct(R.logi_inc_rate)}インセン`}
        value={yen(Math.max(0, pl.op) * R.logi_inc_rate)}
        valueClass="text-good"
        footer={`${pct(R.logi_inc_monthly_rate)} ${payTiming(R.logi_inc_pay_offset, R.logi_inc_pay_day)} / ${pct(R.logi_inc_rate - R.logi_inc_monthly_rate)} 半期プール`}
      />
    );
  }

  const costRows: [string, number][] = [
    ["直接経費（明細計上）", pl.directCost],
    ...(dept === "HR" ? ([["マスターキー手数料", pl.masterKeyFee]] as [string, number][]) : []),
    ["固定費（人件費・配賦等）", pl.fixedCost],
    ...Object.entries(pl.expenseBreakdown),
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full" style={{ background: meta.color }} />
          <h2 className="text-lg font-black">{meta.label}</h2>
          <span className="text-xs text-muted">{monthLabel(data.month)}</span>
        </div>
        <div className="no-print flex gap-2">
          <Button variant="secondary" size="sm" onClick={onAddReferral}>
            <ArrowRightLeft size={14} />
            リファーラル登録
          </Button>
          {canAddExpense && (
            <Button variant="secondary" size="sm" onClick={onAddExpense}>
              <Receipt size={14} />
              経費登録
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="売上"
          value={yen(pl.sales)}
          footer={
            <div className="flex justify-between">
              <span>計画 {yen(pl.planSales)}</span>
              <RateBadge value={rate(pl.sales, pl.planSales)} />
            </div>
          }
        />
        <StatCard label="経費・原価" value={yen(pl.totalCost)} valueClass="text-soft" footer={`計画枠 ${yen(pl.planCost)}`} />
        <StatCard
          label="営業利益"
          value={yen(pl.op)}
          valueClass={pl.op >= 0 ? "text-good" : "text-bad"}
          footer={
            <div className="flex justify-between">
              <span>計画 {yen(pl.planOP)}</span>
              <RateBadge value={rate(pl.op, pl.planOP)} />
            </div>
          }
        />
        {special}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="損益内訳" description="売上 − 費用 = 営業利益" />
          <div className="space-y-1 p-5 text-sm">
            <Row label="明細売上（承認済）" value={pl.grossSales} />
            {pl.referralCredit > 0 && <Row label="＋ リファーラル配分（紹介元）" value={pl.referralCredit} tone="good" />}
            {pl.referralDebit > 0 && <Row label="− リファーラル振替（紹介元へ）" value={-pl.referralDebit} tone="bad" />}
            <Row label="売上計" value={pl.sales} strong />
            <div className="my-2 border-t border-dashed border-line" />
            {costRows.map(([l, v]) => (
              <Row key={l} label={`− ${l}`} value={-v} muted />
            ))}
            <Row label="費用計" value={-pl.totalCost} strong />
            <div className="my-2 border-t border-line" />
            <Row label="営業利益" value={pl.op} strong tone={pl.op >= 0 ? "good" : "bad"} />
            {pl.pendingCount > 0 && (
              <p className="pt-2 text-xs text-warn-ink">※ 承認待ち {pl.pendingCount} 件（{yen(pl.pendingAmount)}）は未反映</p>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="報酬・インセンティブ規程" description="料率はマスター設定から変更できます" />
          <div className="space-y-2 p-5 text-xs leading-relaxed text-soft">
            {dept === "SALES" && (
              <>
                <p>• <b className="text-ink">BARインセン</b>: 単月事業部営業利益が {yen(R.sales_bar_inc_threshold)} 以上の月、BAR売上の {pct(R.sales_bar_inc_rate)} を{payTiming(R.sales_bar_pay_offset)}支給。</p>
                <p>• <b className="text-ink">半期ボーナス</b>: 半期事業部営業利益の {pct(R.sales_half_base_rate)} から支給済BARインセンを控除。目標超過分はさらに {pct(R.sales_half_excess_rate)} を加算。</p>
                <p>• <b className="text-ink">リファーラル</b>: 転職支援は紹介元 {pct(R.ref_split_hr_default)}、引越しは {pct(R.ref_split_moving_default)} を計上。</p>
              </>
            )}
            {dept === "HR" && (
              <>
                <p>• <b className="text-ink">決定手当</b>: 入社決定1件ごとに 広告・自社経由 {yen(R.hr_placement_ad_fee)} ／ リファーラル経由 {yen(R.hr_placement_ref_fee)} を{payTiming(R.hr_placement_pay_offset)}支給。</p>
                <p>• <b className="text-ink">事業部ボーナス（統括）</b>: 半期事業部営業利益の {pct(R.hr_dept_bonus_rate)}、目標超過分は {pct(R.hr_dept_bonus_excess_rate)}。</p>
                <p>• <b className="text-ink">個人PLボーナス</b>: 個人営業利益（個人売上 − MK{pct(R.hr_masterkey_rate)} − 直接経費 − 月 {yen(R.hr_personal_fixed_cost)} 配賦）の {pct(R.hr_personal_bonus_rate)}。</p>
              </>
            )}
            {dept === "LOGI" && (
              <p>• <b className="text-ink">大和利益インセン</b>: 事業部営業利益の {pct(R.logi_inc_rate)}。うち {pct(R.logi_inc_monthly_rate)} を{payTiming(R.logi_inc_pay_offset, R.logi_inc_pay_day)}支給、残りを半期プール。</p>
            )}
            {leaderSummary && leaderItems.length > 0 && (
              <div className="mt-3 rounded-lg bg-subtle p-3">
                <div className="mb-1 font-bold text-ink">当月発生インセンティブ（{leaderSummary.member.name}）</div>
                {leaderItems.map((i) => (
                  <div key={i.id} className="flex justify-between">
                    <span>
                      {i.label}（{monthLabel(i.pay_month)}
                      {i.pay_day}支給）
                    </span>
                    <span className="font-bold tabular-nums text-ink">{yen(i.amount)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader title={`${meta.short} 実績明細`} description="承認待ち・差戻しも表示（PLには確定分のみ反映）" />
        <TxTable
          rows={tx}
          members={data.members}
          showLead={dept === "HR"}
          extra={
            dept === "HR"
              ? {
                  header: "決定手当",
                  render: (t) =>
                    t.category === "CA入社決定" ? (
                      <span className="font-bold text-good">{yen(t.lead_source === "REFERRAL" ? R.hr_placement_ref_fee : R.hr_placement_ad_fee)}</span>
                    ) : (
                      <span className="text-faint">—</span>
                    ),
                }
              : undefined
          }
        />
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="リファーラル（事業部間送客）" />
          {refs.length ? (
            <div className={T.wrap}>
              <table className={T.table}>
                <thead className={T.thead}>
                  <tr>
                    <th className={T.th}>状態</th>
                    <th className={T.th}>案件</th>
                    <th className={T.th}>紹介元 → 送客先</th>
                    <th className={cn(T.th, "text-right")}>総売上</th>
                    <th className={cn(T.th, "text-right")}>紹介元配分</th>
                  </tr>
                </thead>
                <tbody className={T.tbody}>
                  {refs.map((r) => (
                    <tr key={r.ref_id} className={T.tr}>
                      <td className={T.td}>
                        <StatusBadge status={r.status} />
                      </td>
                      <td className={cn(T.td, "font-semibold")}>{r.client_name}</td>
                      <td className={T.td}>
                        {memberName(data.members, r.from_member_id)} → {r.to_dept === "EXTERNAL" ? "社外" : DEPT_META[r.to_dept].short}
                      </td>
                      <td className={T.num}>{yen(r.gross_amount)}</td>
                      <td className={cn(T.num, "font-bold")}>
                        {yen(r.gross_amount * r.split_rate)} <span className="text-muted">({pct(r.split_rate)})</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty>この月のリファーラルはありません</Empty>
          )}
        </Card>
        <Card>
          <CardHeader title="経費実績" description="固定費以外の変動経費（05_T_経費実績）" />
          {exps.length ? (
            <div className={T.wrap}>
              <table className={T.table}>
                <thead className={T.thead}>
                  <tr>
                    <th className={T.th}>科目</th>
                    <th className={T.th}>摘要</th>
                    <th className={cn(T.th, "text-right")}>金額</th>
                  </tr>
                </thead>
                <tbody className={T.tbody}>
                  {exps.map((e) => (
                    <tr key={e.exp_id} className={T.tr}>
                      <td className={T.td}>
                        <Badge>{e.category}</Badge>
                      </td>
                      <td className={T.td}>{e.description}</td>
                      <td className={cn(T.num, "font-bold")}>{yen(e.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty>
              この月の経費登録はありません
              {canAddExpense && (
                <div className="mt-3">
                  <Button size="sm" variant="secondary" onClick={onAddExpense}>
                    <Plus size={14} />
                    経費を登録
                  </Button>
                </div>
              )}
            </Empty>
          )}
        </Card>
      </div>
    </div>
  );
}

function Row({ label, value, strong, muted, tone }: { label: string; value: number; strong?: boolean; muted?: boolean; tone?: "good" | "bad" }) {
  return (
    <div className={cn("flex justify-between", strong && "font-bold text-ink", muted && "text-soft")}>
      <span>{label}</span>
      <span className={cn("tabular-nums", tone === "good" && "text-good", tone === "bad" && "text-bad")}>{yen(value)}</span>
    </div>
  );
}
