"use client";

import { CalendarClock, PiggyBank, Wallet } from "lucide-react";
import { useState } from "react";
import { Badge, Card, CardHeader, Empty, T } from "@/components/ui";
import { DEPT_META, HALF_LABEL } from "@/lib/constants";
import { cn } from "@/lib/cn";
import type { HalfBonusItem, MemberSummary, PaySummary } from "@/lib/finance-engine";
import { monthLabel, yen } from "@/lib/format";
import type { DashboardData } from "@/lib/view-model";
import { TxTable } from "./shared";

const sumAmt = (xs: { amount: number }[]) => xs.reduce((s, x) => s + x.amount, 0);

export function PersonalTab({ data }: { data: DashboardData }) {
  const [selected, setSelected] = useState(() =>
    data.me.role === "ADMIN" ? (data.summaries.find((s) => s.member.department !== "HQ")?.member.member_id ?? data.me.member_id) : data.me.member_id,
  );
  const summary = data.summaries.find((s) => s.member.member_id === selected) ?? data.summaries.find((s) => s.member.member_id === data.me.member_id);

  return (
    <div className="space-y-6">
      {data.me.role === "ADMIN" && <AdminPayroll data={data} selected={summary?.member.member_id} onSelect={setSelected} />}
      {data.me.role === "LEADER" && data.team.length > 0 && <TeamTable data={data} />}
      {summary ? <MemberDetail data={data} s={summary} /> : <Empty>給与見立てを表示できるメンバーがいません</Empty>}
    </div>
  );
}

function AdminPayroll({ data, selected, onSelect }: { data: DashboardData; selected?: string; onSelect: (id: string) => void }) {
  const rows = data.summaries;
  return (
    <Card className="border-brand/30">
      <CardHeader
        title={
          <span className="flex items-center gap-2">
            <Badge tone="brand">ADMIN ONLY</Badge>全員の給与見立て・個人PL（{monthLabel(data.month)}）
          </span>
        }
        description="当月支給額 = 基本給 + 当月が支給日のインセンティブ。半期ボーナスは実績ベースの現時点プール額。"
        action={
          <div className="flex gap-4 text-right text-xs">
            <div>
              <div className="text-muted">当月支給総額</div>
              <div className="text-sm font-black tabular-nums text-brand">{yen(rows.reduce((s, r) => s + r.payThisMonth.total, 0))}</div>
            </div>
            <div>
              <div className="text-muted">半期プール総額</div>
              <div className="text-sm font-black tabular-nums text-warn-ink">{yen(rows.reduce((s, r) => s + sumAmt(r.halfBonusActual), 0))}</div>
            </div>
          </div>
        }
      />
      <div className={T.wrap}>
        <table className={T.table}>
          <thead className={T.thead}>
            <tr>
              <th className={T.th}>メンバー</th>
              <th className={T.th}>所属</th>
              <th className={cn(T.th, "text-right")}>当月個人売上</th>
              <th className={cn(T.th, "text-right")}>基本給</th>
              <th className={cn(T.th, "text-right")}>当月支給インセン</th>
              <th className={cn(T.th, "text-right text-brand")}>当月支給額</th>
              <th className={cn(T.th, "text-right")}>翌月支給見込み</th>
              <th className={cn(T.th, "text-right text-warn-ink")}>半期プール（実績）</th>
              <th className={T.th}></th>
            </tr>
          </thead>
          <tbody className={T.tbody}>
            {rows.map((r) => {
              const inc = sumAmt(r.payThisMonth.items) + sumAmt(r.payThisMonth.bonuses);
              const isSel = r.member.member_id === selected;
              return (
                <tr key={r.member.member_id} className={cn(T.tr, "cursor-pointer", isSel && "bg-brand/5")} onClick={() => onSelect(r.member.member_id)}>
                  <td className={cn(T.td, "font-bold")}>
                    {r.member.name}
                    {r.pendingCount > 0 && <Badge tone="warn" className="ml-2">承認待ち {r.pendingCount}</Badge>}
                  </td>
                  <td className={T.td}>
                    <Badge>{DEPT_META[r.member.department].short}</Badge>
                  </td>
                  <td className={cn(T.num, "font-semibold")}>{yen(r.personalSales)}</td>
                  <td className={cn(T.num, "text-soft")}>{yen(r.member.base_salary)}</td>
                  <td className={cn(T.num, "font-bold text-good")}>{inc ? `+${yen(inc)}` : <span className="text-faint">—</span>}</td>
                  <td className={cn(T.num, "text-sm font-black text-brand")}>{yen(r.payThisMonth.total)}</td>
                  <td className={cn(T.num, "text-soft")}>{yen(r.payNextMonth.total)}</td>
                  <td className={cn(T.num, "text-sm font-black text-warn-ink")}>{yen(sumAmt(r.halfBonusActual))}</td>
                  <td className={T.td}>
                    <span className={cn("rounded px-2 py-0.5 text-[11px] font-bold", isSel ? "bg-brand text-white" : "bg-subtle text-soft")}>{isSel ? "表示中" : "明細"}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function TeamTable({ data }: { data: DashboardData }) {
  return (
    <Card>
      <CardHeader title={`${DEPT_META[data.me.department].label} メンバー実績（${monthLabel(data.month)}）`} description="統括は自事業部メンバーの実績を閲覧できます（給与は本人と本部のみ）" />
      <div className={T.wrap}>
        <table className={T.table}>
          <thead className={T.thead}>
            <tr>
              <th className={T.th}>メンバー</th>
              <th className={cn(T.th, "text-right")}>確定売上</th>
              <th className={cn(T.th, "text-right")}>確定件数</th>
              <th className={cn(T.th, "text-right")}>承認待ち</th>
            </tr>
          </thead>
          <tbody className={T.tbody}>
            {data.team.map((r) => (
              <tr key={r.member.member_id} className={T.tr}>
                <td className={cn(T.td, "font-bold")}>{r.member.name}</td>
                <td className={cn(T.num, "font-bold")}>{yen(r.sales)}</td>
                <td className={T.num}>{r.txCount}件</td>
                <td className={T.num}>{r.pendingCount ? <Badge tone="warn">{r.pendingCount}件</Badge> : <span className="text-faint">—</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function MemberDetail({ data, s }: { data: DashboardData; s: MemberSummary }) {
  const isMe = s.member.member_id === data.me.member_id;
  const actual = sumAmt(s.halfBonusActual);
  const forecast = sumAmt(s.halfBonusForecast);
  const payMonth = s.halfBonusActual[0]?.pay_month;
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-baseline gap-2">
        <h2 className="text-lg font-black">{isMe ? "あなた" : s.member.name + " さん"}の給与見立て</h2>
        <span className="text-xs text-muted">
          {DEPT_META[s.member.department].label} / {s.member.role} ・ {monthLabel(s.month)}時点
        </span>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <PayCard title={`${monthLabel(s.month)} 支給額`} icon={<Wallet size={16} />} pay={s.payThisMonth} accent="text-brand" />
        <PayCard title={`${monthLabel(s.payNextMonth.month)} 支給見込み`} icon={<CalendarClock size={16} />} pay={s.payNextMonth} accent="text-ink" note="当月実績の確定・承認状況で変動します" />
        <Card className="p-5">
          <div className="flex items-center justify-between text-xs font-semibold text-muted">
            <span>{HALF_LABEL[s.half]} ボーナス</span>
            <PiggyBank size={16} className="text-faint" />
          </div>
          <div className="mt-1.5 text-2xl font-black tabular-nums text-warn-ink sm:text-[1.7rem]">{yen(actual)}</div>
          <div className="text-xs text-muted">現時点の実績ベース</div>
          <div className="mt-3 space-y-1 border-t border-line pt-2.5 text-xs text-soft">
            <div className="flex justify-between">
              <span>着地見込み（残り月は計画達成と仮定）</span>
              <span className="font-bold tabular-nums text-ink">{yen(forecast)}</span>
            </div>
            {payMonth && (
              <div className="flex justify-between">
                <span>清算・支給予定</span>
                <span className="font-bold">{monthLabel(payMonth)}末</span>
              </div>
            )}
          </div>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="当月に発生したインセンティブ" description="発生月と支給月は異なります（翌月末・翌々月15日など）" />
          {s.earnedThisMonth.length ? (
            <ul className="divide-y divide-line text-xs">
              {s.earnedThisMonth.map((i) => (
                <li key={i.id} className="flex items-start justify-between gap-3 px-5 py-3">
                  <div className="min-w-0">
                    <div className="font-bold text-ink">{i.label}</div>
                    <div className="truncate text-muted">{i.basis}</div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="font-bold tabular-nums text-good">+{yen(i.amount)}</div>
                    <div className="text-[11px] text-muted">
                      {monthLabel(i.pay_month)}
                      {i.pay_day}支給
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>当月発生のインセンティブはまだありません</Empty>
          )}
        </Card>
        <Card>
          <CardHeader title="半期ボーナスの計算根拠" />
          <BonusList items={s.halfBonusActual} forecast={s.halfBonusForecast} />
        </Card>
      </div>

      <Card>
        <CardHeader title={`${monthLabel(s.month)} 個人計上明細`} description={`確定 ${s.personalTxCount} 件 ・ 個人売上 ${yen(s.personalSales)}（リファーラル配分含む）`} />
        <TxTable rows={data.transactions.filter((t) => t.member_id === s.member.member_id)} members={data.members} showMember={false} empty="当月の個人計上明細はありません" />
      </Card>
    </div>
  );
}

function PayCard({ title, icon, pay, accent, note }: { title: string; icon: React.ReactNode; pay: PaySummary; accent: string; note?: string }) {
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between text-xs font-semibold text-muted">
        <span>{title}</span>
        <span className="text-faint">{icon}</span>
      </div>
      <div className={cn("mt-1.5 text-2xl font-black tabular-nums sm:text-[1.7rem]", accent)}>{yen(pay.total)}</div>
      <div className="mt-3 space-y-1 border-t border-line pt-2.5 text-xs text-soft">
        <div className="flex justify-between">
          <span>基本給</span>
          <span className="tabular-nums">{yen(pay.base)}</span>
        </div>
        {pay.items.map((i) => (
          <div key={i.id} className="flex justify-between text-good">
            <span className="truncate">
              {i.label}（{monthLabel(i.earned_month)}分）
            </span>
            <span className="font-bold tabular-nums">+{yen(i.amount)}</span>
          </div>
        ))}
        {pay.bonuses.map((b) => (
          <div key={b.kind} className="flex justify-between text-warn-ink">
            <span>{b.label}</span>
            <span className="font-bold tabular-nums">+{yen(b.amount)}</span>
          </div>
        ))}
        {note && <div className="pt-1 text-[11px] text-muted">{note}</div>}
      </div>
    </Card>
  );
}

function BonusList({ items, forecast }: { items: HalfBonusItem[]; forecast: HalfBonusItem[] }) {
  if (!items.length) return <Empty>半期ボーナスの対象外です</Empty>;
  return (
    <ul className="divide-y divide-line text-xs">
      {items.map((b) => {
        const f = forecast.find((x) => x.kind === b.kind);
        return (
          <li key={b.kind} className="px-5 py-3">
            <div className="flex justify-between">
              <span className="font-bold text-ink">{b.label}</span>
              <span className="font-bold tabular-nums text-warn-ink">{yen(b.amount)}</span>
            </div>
            <div className="mt-0.5 text-muted">{b.basis}</div>
            {f && f.amount !== b.amount && <div className="mt-0.5 text-soft">着地見込み: {yen(f.amount)}</div>}
          </li>
        );
      })}
    </ul>
  );
}
