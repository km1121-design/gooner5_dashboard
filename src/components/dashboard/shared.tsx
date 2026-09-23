"use client";

import { Badge, Empty, T } from "@/components/ui";
import { cn } from "@/lib/cn";
import { yen } from "@/lib/format";
import type { SalesTransaction, TxStatus } from "@/lib/types";
import type { PublicMember } from "@/lib/view-model";

export function StatusBadge({ status }: { status: TxStatus }) {
  if (status === "APPROVED") return <Badge tone="good">確定</Badge>;
  if (status === "PENDING") return <Badge tone="warn">承認待ち</Badge>;
  return <Badge tone="bad">差戻し</Badge>;
}

export const LEAD_LABEL: Record<SalesTransaction["lead_source"], string> = {
  DIRECT: "直接・自社",
  AD: "広告",
  REFERRAL: "リファーラル",
};

export function memberName(members: PublicMember[], id: string) {
  return members.find((m) => m.member_id === id)?.name ?? id;
}

export function TxTable({
  rows,
  members,
  showMember = true,
  showLead = false,
  extra,
  empty = "この月の実績はまだありません",
}: {
  rows: SalesTransaction[];
  members: PublicMember[];
  showMember?: boolean;
  showLead?: boolean;
  extra?: { header: string; render: (t: SalesTransaction) => React.ReactNode };
  empty?: string;
}) {
  if (!rows.length) return <Empty>{empty}</Empty>;
  const sorted = [...rows].sort((a, b) => a.date.localeCompare(b.date));
  return (
    <div className={T.wrap}>
      <table className={T.table}>
        <thead className={T.thead}>
          <tr>
            <th className={T.th}>計上日</th>
            <th className={T.th}>状態</th>
            {showMember && <th className={T.th}>担当</th>}
            <th className={T.th}>区分</th>
            <th className={T.th}>案件内容</th>
            {showLead && <th className={T.th}>流入</th>}
            <th className={cn(T.th, "text-right")}>売上</th>
            <th className={cn(T.th, "text-right")}>直接経費</th>
            {extra && <th className={cn(T.th, "text-right")}>{extra.header}</th>}
          </tr>
        </thead>
        <tbody className={T.tbody}>
          {sorted.map((t) => (
            <tr key={t.tx_id} className={cn(T.tr, t.status === "REJECTED" && "opacity-60")}>
              <td className={cn(T.td, "font-mono text-muted")}>{t.date}</td>
              <td className={T.td}>
                <StatusBadge status={t.status} />
              </td>
              {showMember && <td className={cn(T.td, "font-semibold")}>{memberName(members, t.member_id)}</td>}
              <td className={T.td}>
                <Badge>{t.category}</Badge>
              </td>
              <td className={cn(T.td, "max-w-[22rem] truncate font-semibold text-ink")} title={t.notes ? `${t.title}\n${t.notes}` : t.title}>
                {t.title}
                {t.notes && <div className="truncate text-[11px] font-normal text-muted">{t.notes}</div>}
              </td>
              {showLead && (
                <td className={T.td}>
                  <Badge tone={t.lead_source === "REFERRAL" ? "violet" : "neutral"}>{LEAD_LABEL[t.lead_source]}</Badge>
                </td>
              )}
              <td className={cn(T.num, "font-bold")}>{yen(t.gross_sales)}</td>
              <td className={cn(T.num, "text-muted")}>{yen(t.direct_cost)}</td>
              {extra && <td className={T.num}>{extra.render(t)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
