"use client";

import { Check, X } from "lucide-react";
import { useState } from "react";
import { Badge, Button, Card, CardHeader, Empty, T } from "@/components/ui";
import { DEPT_META } from "@/lib/constants";
import { cn } from "@/lib/cn";
import { yen } from "@/lib/format";
import type { DashboardData } from "@/lib/view-model";
import { api } from "./api";
import { LEAD_LABEL, memberName } from "./shared";

export function ApprovalsTab({ data, onChanged, notify }: { data: DashboardData; onChanged: () => void; notify: (msg: string, error?: boolean) => void }) {
  const [busy, setBusy] = useState<string | null>(null);

  async function act(kind: "transactions" | "referrals", id: string, action: "approve" | "reject") {
    let reason = "";
    if (action === "reject") {
      const r = window.prompt("差戻し理由（任意）");
      if (r === null) return;
      reason = r;
    }
    setBusy(id);
    try {
      await api(`/api/${kind}/${id}`, "PATCH", { action, reason });
      notify(action === "approve" ? "承認しました（PLに反映済み）" : "差し戻しました");
      onChanged();
    } catch (e) {
      notify(e instanceof Error ? e.message : String(e), true);
    } finally {
      setBusy(null);
    }
  }

  const sorted = [...data.approvals].sort((a, b) => a.date.localeCompare(b.date));

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader
          title={`売上実績 承認待ち（${sorted.length}件）`}
          description={data.me.role === "ADMIN" ? "全事業部の報告を承認できます" : "自事業部メンバーの報告を承認できます（自分の報告は本部が承認）"}
        />
        {sorted.length ? (
          <div className={T.wrap}>
            <table className={T.table}>
              <thead className={T.thead}>
                <tr>
                  <th className={T.th}>計上日</th>
                  <th className={T.th}>事業部</th>
                  <th className={T.th}>担当</th>
                  <th className={T.th}>区分 / 案件</th>
                  <th className={T.th}>流入</th>
                  <th className={cn(T.th, "text-right")}>売上</th>
                  <th className={cn(T.th, "text-right")}>直接経費</th>
                  <th className={T.th}>報告者</th>
                  <th className={cn(T.th, "text-right")}>操作</th>
                </tr>
              </thead>
              <tbody className={T.tbody}>
                {sorted.map((t) => (
                  <tr key={t.tx_id} className={T.tr}>
                    <td className={cn(T.td, "font-mono text-muted")}>{t.date}</td>
                    <td className={T.td}>
                      <Badge>{DEPT_META[t.department].short}</Badge>
                    </td>
                    <td className={cn(T.td, "font-semibold")}>{memberName(data.members, t.member_id)}</td>
                    <td className={T.td}>
                      <div className="font-semibold text-ink">{t.title}</div>
                      <div className="text-muted">
                        {t.category}
                        {t.notes && ` ・ ${t.notes}`}
                      </div>
                    </td>
                    <td className={T.td}>{LEAD_LABEL[t.lead_source]}</td>
                    <td className={cn(T.num, "font-bold")}>{yen(t.gross_sales)}</td>
                    <td className={cn(T.num, "text-muted")}>{yen(t.direct_cost)}</td>
                    <td className={cn(T.td, "text-muted")}>{memberName(data.members, t.created_by)}</td>
                    <td className={cn(T.td, "text-right")}>
                      <div className="flex justify-end gap-1.5">
                        <Button size="sm" variant="success" disabled={busy === t.tx_id} onClick={() => act("transactions", t.tx_id, "approve")}>
                          <Check size={14} />
                          承認
                        </Button>
                        <Button size="sm" variant="danger" disabled={busy === t.tx_id} onClick={() => act("transactions", t.tx_id, "reject")}>
                          <X size={14} />
                          差戻し
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty>承認待ちの報告はありません 🎉</Empty>
        )}
      </Card>

      {data.me.role === "ADMIN" && (
        <Card>
          <CardHeader title={`リファーラル 承認待ち（${data.referralApprovals.length}件）`} description="事業部をまたぐ売上振替のため本部が承認します" />
          {data.referralApprovals.length ? (
            <div className={T.wrap}>
              <table className={T.table}>
                <thead className={T.thead}>
                  <tr>
                    <th className={T.th}>年月</th>
                    <th className={T.th}>案件</th>
                    <th className={T.th}>紹介元 → 送客先</th>
                    <th className={cn(T.th, "text-right")}>総売上</th>
                    <th className={cn(T.th, "text-right")}>紹介元配分</th>
                    <th className={cn(T.th, "text-right")}>操作</th>
                  </tr>
                </thead>
                <tbody className={T.tbody}>
                  {data.referralApprovals.map((r) => (
                    <tr key={r.ref_id} className={T.tr}>
                      <td className={T.td}>{r.year_month}</td>
                      <td className={cn(T.td, "font-semibold")}>{r.client_name}</td>
                      <td className={T.td}>
                        {memberName(data.members, r.from_member_id)} → {r.to_dept === "EXTERNAL" ? "社外" : DEPT_META[r.to_dept].short}
                      </td>
                      <td className={T.num}>{yen(r.gross_amount)}</td>
                      <td className={cn(T.num, "font-bold")}>
                        {yen(r.gross_amount * r.split_rate)}（{Math.round(r.split_rate * 100)}%）
                      </td>
                      <td className={cn(T.td, "text-right")}>
                        <div className="flex justify-end gap-1.5">
                          <Button size="sm" variant="success" disabled={busy === r.ref_id} onClick={() => act("referrals", r.ref_id, "approve")}>
                            <Check size={14} />
                            承認
                          </Button>
                          <Button size="sm" variant="danger" disabled={busy === r.ref_id} onClick={() => act("referrals", r.ref_id, "reject")}>
                            <X size={14} />
                            差戻し
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty>承認待ちのリファーラルはありません</Empty>
          )}
        </Card>
      )}
    </div>
  );
}
