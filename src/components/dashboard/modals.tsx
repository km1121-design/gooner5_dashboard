"use client";

import { useState } from "react";
import { Button, Field, Input, Modal, Select } from "@/components/ui";
import { ALL_DEPTS, BUSINESS_DEPTS, CATEGORY_OPTIONS, DEPT_META, EXPENSE_CATEGORIES } from "@/lib/constants";
import { yen } from "@/lib/format";
import type { BusinessDept, Dept } from "@/lib/types";
import type { DashboardData } from "@/lib/view-model";
import { api } from "./api";

type Notify = (msg: string, error?: boolean) => void;

function defaultDate(month: string, today: string) {
  return today.startsWith(month) ? today : `${month}-01`;
}

function Actions({ onClose, busy, label }: { onClose: () => void; busy: boolean; label: string }) {
  return (
    <div className="flex justify-end gap-2 pt-2">
      <Button type="button" variant="secondary" onClick={onClose}>
        キャンセル
      </Button>
      <Button type="submit" disabled={busy}>
        {busy ? "送信中…" : label}
      </Button>
    </div>
  );
}

export function AddTransactionModal({ open, onClose, data, onDone, notify }: { open: boolean; onClose: () => void; data: DashboardData; onDone: () => void; notify: Notify }) {
  const members = data.reportableMembers;
  const me = members.find((m) => m.member_id === data.me.member_id);
  const initialMember = me ?? members[0];
  const initialDept: BusinessDept = (initialMember && initialMember.department !== "HQ" ? initialMember.department : "SALES") as BusinessDept;
  const [f, setF] = useState(() => ({
    date: defaultDate(data.month, data.today),
    member_id: initialMember?.member_id ?? "",
    department: initialDept,
    category: CATEGORY_OPTIONS[initialDept][0],
    title: "",
    gross_sales: "",
    direct_cost: "0",
    lead_source: "DIRECT",
    notes: "",
  }));
  const [busy, setBusy] = useState(false);
  const autoApprove = data.me.role === "ADMIN";
  const deptMembers = members.filter((m) => data.me.role === "ADMIN" || m.department === f.department);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api("/api/transactions", "POST", { ...f, gross_sales: Number(f.gross_sales), direct_cost: Number(f.direct_cost || 0) });
      notify(autoApprove ? "実績を登録しました（即時確定）" : "実績を報告しました。承認後にPLへ反映されます");
      onDone();
      onClose();
    } catch (err) {
      notify(err instanceof Error ? err.message : String(err), true);
    } finally {
      setBusy(false);
    }
  }

  const deptOptions = data.me.role === "ADMIN" ? BUSINESS_DEPTS : BUSINESS_DEPTS.filter((d) => d === data.me.department);

  return (
    <Modal open={open} onClose={onClose} title="売上実績の報告">
      {!members.length ? (
        <p className="text-sm text-muted">実績を報告できる事業部に所属していません。</p>
      ) : (
        <form onSubmit={submit} className="space-y-3.5">
          <div className="grid grid-cols-2 gap-3">
            <Field label="計上日">
              <Input type="date" required value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} />
            </Field>
            <Field label="事業部">
              <Select
                value={f.department}
                onChange={(e) => {
                  const d = e.target.value as BusinessDept;
                  setF({ ...f, department: d, category: CATEGORY_OPTIONS[d][0] });
                }}
              >
                {deptOptions.map((d) => (
                  <option key={d} value={d}>
                    {DEPT_META[d].label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="担当者">
              <Select value={f.member_id} onChange={(e) => setF({ ...f, member_id: e.target.value })}>
                {deptMembers.map((m) => (
                  <option key={m.member_id} value={m.member_id}>
                    {m.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="区分">
              <Select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>
                {CATEGORY_OPTIONS[f.department].map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </Select>
            </Field>
          </div>
          <Field label="案件名 / 内容">
            <Input required placeholder="例: 株式会社〇〇（Webエンジニア入社決定）" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="売上金額（税抜）">
              <Input type="number" min={0} required inputMode="numeric" value={f.gross_sales} onChange={(e) => setF({ ...f, gross_sales: e.target.value })} />
            </Field>
            <Field label={f.department === "LOGI" ? "外注費・直接経費" : "直接経費"}>
              <Input type="number" min={0} inputMode="numeric" value={f.direct_cost} onChange={(e) => setF({ ...f, direct_cost: e.target.value })} />
            </Field>
          </div>
          <Field
            label="流入経路"
            hint={f.department === "HR" && f.category === "CA入社決定" ? `決定手当: 広告・自社 ${yen(data.rules.hr_placement_ad_fee)} ／ リファーラル ${yen(data.rules.hr_placement_ref_fee)}` : undefined}
          >
            <Select value={f.lead_source} onChange={(e) => setF({ ...f, lead_source: e.target.value })}>
              <option value="DIRECT">直接・自社</option>
              <option value="AD">広告経由</option>
              <option value="REFERRAL">リファーラル紹介</option>
            </Select>
          </Field>
          <Field label="備考（任意）">
            <Input value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
          </Field>
          <p className="rounded-lg bg-subtle px-3 py-2 text-xs text-soft">
            {autoApprove ? "本部の登録は即時確定され、PLへ反映されます。" : "報告は「承認待ち」になり、統括または本部の承認後にPL・インセンティブへ反映されます。"}
            事業部間の送客は「リファーラル登録」から登録してください。
          </p>
          <Actions onClose={onClose} busy={busy} label={autoApprove ? "登録して確定" : "報告する"} />
        </form>
      )}
    </Modal>
  );
}

export function ReferralModal({ open, onClose, data, onDone, notify }: { open: boolean; onClose: () => void; data: DashboardData; onDone: () => void; notify: Notify }) {
  const candidates = data.me.role === "ADMIN" ? data.members.filter((m) => m.department !== "HQ") : data.members.filter((m) => m.member_id === data.me.member_id || (data.me.role === "LEADER" && m.department === data.me.department));
  const [f, setF] = useState(() => ({
    year_month: data.month,
    from_member_id: candidates.find((m) => m.member_id === data.me.member_id)?.member_id ?? candidates[0]?.member_id ?? "",
    to_dept: "HR",
    client_name: "",
    gross_amount: "",
    split_rate: String(data.rules.ref_split_hr_default ?? 0.5),
  }));
  const [busy, setBusy] = useState(false);
  const share = Number(f.gross_amount || 0) * Number(f.split_rate || 0);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api("/api/referrals", "POST", { ...f, gross_amount: Number(f.gross_amount), split_rate: Number(f.split_rate) });
      notify(data.me.role === "ADMIN" ? "リファーラルを登録しました" : "リファーラルを報告しました（本部承認後に反映）");
      onDone();
      onClose();
    } catch (err) {
      notify(err instanceof Error ? err.message : String(err), true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="リファーラル（事業部間送客）の登録">
      <form onSubmit={submit} className="space-y-3.5">
        <div className="grid grid-cols-2 gap-3">
          <Field label="対象年月">
            <Input type="month" required value={f.year_month} onChange={(e) => setF({ ...f, year_month: e.target.value })} />
          </Field>
          <Field label="紹介元担当者">
            <Select value={f.from_member_id} onChange={(e) => setF({ ...f, from_member_id: e.target.value })}>
              {candidates.map((m) => (
                <option key={m.member_id} value={m.member_id}>
                  {m.name}（{DEPT_META[m.department].short}）
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="送客先" hint="社内事業部の場合、送客先の売上から紹介元へ配分額が振り替えられます（全社売上は二重計上されません）">
          <Select
            value={f.to_dept}
            onChange={(e) => {
              const to = e.target.value;
              const def = to === "EXTERNAL" ? data.rules.ref_split_moving_default : to === "HR" ? data.rules.ref_split_hr_default : Number(f.split_rate);
              setF({ ...f, to_dept: to, split_rate: String(def ?? f.split_rate) });
            }}
          >
            {BUSINESS_DEPTS.map((d) => (
              <option key={d} value={d}>
                {DEPT_META[d].label}
              </option>
            ))}
            <option value="EXTERNAL">社外パートナー（引越し等）</option>
          </Select>
        </Field>
        <Field label="案件名">
          <Input required placeholder="例: 転職支援（A氏）" value={f.client_name} onChange={(e) => setF({ ...f, client_name: e.target.value })} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="成立総売上">
            <Input type="number" min={0} required value={f.gross_amount} onChange={(e) => setF({ ...f, gross_amount: e.target.value })} />
          </Field>
          <Field label="紹介元配分率（0〜1）">
            <Input type="number" min={0} max={1} step={0.05} required value={f.split_rate} onChange={(e) => setF({ ...f, split_rate: e.target.value })} />
          </Field>
        </div>
        <p className="rounded-lg bg-subtle px-3 py-2 text-xs text-soft">
          紹介元への計上額: <b className="text-ink">{yen(share)}</b>
        </p>
        <Actions onClose={onClose} busy={busy} label="登録する" />
      </form>
    </Modal>
  );
}

export function ExpenseModal({ open, onClose, data, onDone, notify, dept }: { open: boolean; onClose: () => void; data: DashboardData; onDone: () => void; notify: Notify; dept: Dept }) {
  const [f, setF] = useState(() => ({ year_month: data.month, department: dept, category: EXPENSE_CATEGORIES[0], amount: "", description: "" }));
  const [busy, setBusy] = useState(false);
  const depts = data.me.role === "ADMIN" ? ALL_DEPTS : ALL_DEPTS.filter((d) => d === data.me.department);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api("/api/expenses", "POST", { ...f, amount: Number(f.amount) });
      notify("経費を登録しました");
      onDone();
      onClose();
    } catch (err) {
      notify(err instanceof Error ? err.message : String(err), true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="経費実績の登録">
      <form onSubmit={submit} className="space-y-3.5">
        <div className="grid grid-cols-2 gap-3">
          <Field label="対象年月">
            <Input type="month" required value={f.year_month} onChange={(e) => setF({ ...f, year_month: e.target.value })} />
          </Field>
          <Field label="事業部">
            <Select value={f.department} onChange={(e) => setF({ ...f, department: e.target.value as Dept })}>
              {depts.map((d) => (
                <option key={d} value={d}>
                  {DEPT_META[d].label}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="科目">
            <Select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>
              {EXPENSE_CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </Select>
          </Field>
          <Field label="金額">
            <Input type="number" required value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} />
          </Field>
        </div>
        <Field label="摘要">
          <Input placeholder="例: バイトル掲載" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
        </Field>
        <Actions onClose={onClose} busy={busy} label="登録する" />
      </form>
    </Modal>
  );
}
