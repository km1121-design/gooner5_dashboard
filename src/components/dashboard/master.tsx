"use client";

import { Plus, Save } from "lucide-react";
import { useMemo, useState } from "react";
import { Badge, Button, Card, CardHeader, T } from "@/components/ui";
import { ALL_DEPTS, BUSINESS_DEPTS, DEPT_META, TERM_MONTHS } from "@/lib/constants";
import { cn } from "@/lib/cn";
import { yen } from "@/lib/format";
import type { BusinessDept, ConfigParam, Member, MonthlyPlan } from "@/lib/types";
import type { DashboardData } from "@/lib/view-model";
import { api } from "./api";

const numCls = "w-28 rounded-md border border-line bg-surface px-2 py-1 text-right text-xs tabular-nums outline-none focus:border-brand";
const txtCls = "w-full rounded-md border border-line bg-surface px-2 py-1 text-xs outline-none focus:border-brand";

export function MasterTab({ data, onSaved, notify }: { data: DashboardData; onSaved: () => void; notify: (msg: string, error?: boolean) => void }) {
  const master = data.master!;
  const [plans, setPlans] = useState<MonthlyPlan[]>(() => fillPlans(master.plans));
  const [params, setParams] = useState<ConfigParam[]>(master.params);
  const [members, setMembers] = useState<Member[]>(master.members);
  const [dirty, setDirty] = useState<{ plans: Set<string>; params: Set<string>; members: Set<string> }>({ plans: new Set(), params: new Set(), members: new Set() });
  const [saving, setSaving] = useState(false);
  const dirtyCount = dirty.plans.size + dirty.params.size + dirty.members.size;

  const mark = (k: keyof typeof dirty, id: string) => setDirty((d) => ({ ...d, [k]: new Set(d[k]).add(id) }));

  const setPlan = (ym: string, dept: BusinessDept, field: "target_sales" | "target_op", v: number) => {
    setPlans((ps) => ps.map((p) => (p.year_month === ym && p.department === dept ? { ...p, [field]: v } : p)));
    mark("plans", `${ym}_${dept}`);
  };

  const totals = useMemo(() => {
    const t: Record<string, { s: number; o: number }> = {};
    for (const d of BUSINESS_DEPTS) t[d] = { s: 0, o: 0 };
    for (const p of plans) {
      if (!t[p.department]) continue;
      t[p.department].s += p.target_sales;
      t[p.department].o += p.target_op;
    }
    return t;
  }, [plans]);

  async function save() {
    setSaving(true);
    try {
      await api("/api/master", "PUT", {
        plans: plans.filter((p) => dirty.plans.has(p.plan_id)),
        params: params.filter((p) => dirty.params.has(p.config_key)),
        members: members.filter((m) => dirty.members.has(m.member_id)),
      });
      setDirty({ plans: new Set(), params: new Set(), members: new Set() });
      notify("マスター設定を保存しました（スプレッドシートへ反映）");
      onSaved();
    } catch (e) {
      notify(e instanceof Error ? e.message : String(e), true);
    } finally {
      setSaving(false);
    }
  }

  function addMember() {
    const nums = members.map((m) => Number(m.member_id.replace(/\D/g, "")) || 0);
    const id = `MEM_${String(Math.max(0, ...nums) + 1).padStart(3, "0")}`;
    setMembers((ms) => [...ms, { member_id: id, name: "", department: "HR", role: "MEMBER", base_salary: 0, is_active: true, email: "" }]);
    mark("members", id);
  }

  const updMember = (id: string, patch: Partial<Member>) => {
    setMembers((ms) => ms.map((m) => (m.member_id === id ? { ...m, ...patch } : m)));
    mark("members", id);
  };

  return (
    <div className="space-y-6">
      <Card className="flex flex-wrap items-center justify-between gap-3 p-5">
        <div>
          <h2 className="text-lg font-black">マスター管理・条件設定</h2>
          <p className="mt-0.5 text-xs text-muted">事業計画・料率・メンバー（基本給）を変更できます。保存するとスプレッドシートに書き込まれ、全画面の計算に即時反映されます。</p>
        </div>
        <Button onClick={save} disabled={!dirtyCount || saving}>
          <Save size={15} />
          {saving ? "保存中…" : dirtyCount ? `変更を保存（${dirtyCount}）` : "変更なし"}
        </Button>
      </Card>

      <Card>
        <CardHeader title="1. 事業計画（月次 目標売上 / 目標営業利益）" description="02_M_事業計画。推移グラフ・達成率・半期目標（パラメータが0の場合）に連動します" />
        <div className={T.wrap}>
          <table className={T.table}>
            <thead className={T.thead}>
              <tr>
                <th className={T.th} rowSpan={2}>
                  月度
                </th>
                {BUSINESS_DEPTS.map((d) => (
                  <th key={d} className={cn(T.th, "text-center")} colSpan={2}>
                    <span className="mr-1 inline-block h-2 w-2 rounded-full" style={{ background: DEPT_META[d].color }} />
                    {DEPT_META[d].short}
                  </th>
                ))}
              </tr>
              <tr>
                {BUSINESS_DEPTS.map((d) => (
                  <FragmentHeaders key={d} />
                ))}
              </tr>
            </thead>
            <tbody className={T.tbody}>
              {TERM_MONTHS.map((m) => (
                <tr key={m.key} className={cn(T.tr, m.key === data.month && "bg-brand/5")}>
                  <td className={cn(T.td, "font-bold")}>
                    {m.label} <Badge tone={m.half === "H1" ? "brand" : "violet"}>{m.half}</Badge>
                  </td>
                  {BUSINESS_DEPTS.map((d) => {
                    const p = plans.find((x) => x.year_month === m.key && x.department === d)!;
                    return (
                      <PlanCells key={d} p={p} onChange={(f, v) => setPlan(m.key, d, f, v)} dirty={dirty.plans.has(p.plan_id)} />
                    );
                  })}
                </tr>
              ))}
              <tr className="bg-subtle/70 font-bold">
                <td className={T.td}>通期合計</td>
                {BUSINESS_DEPTS.map((d) => (
                  <FragmentTotals key={d} s={totals[d].s} o={totals[d].o} />
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <CardHeader title="2. 設定パラメータ（固定費・料率・閾値）" description="03_M_設定パラメータ。率は小数（10% = 0.1）で入力します" />
        <div className={T.wrap}>
          <table className={T.table}>
            <thead className={T.thead}>
              <tr>
                <th className={T.th}>説明</th>
                <th className={T.th}>キー</th>
                <th className={cn(T.th, "text-right")}>設定値</th>
              </tr>
            </thead>
            <tbody className={T.tbody}>
              {params.map((p) => (
                <tr key={p.config_key} className={cn(T.tr, dirty.params.has(p.config_key) && "bg-warn/10")}>
                  <td className={cn(T.td, "font-semibold text-ink")}>{p.description}</td>
                  <td className={cn(T.td, "font-mono text-muted")}>{p.config_key}</td>
                  <td className={cn(T.td, "text-right")}>
                    <input
                      type="number"
                      step="any"
                      className={numCls}
                      value={p.config_value}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        setParams((ps) => ps.map((x) => (x.config_key === p.config_key ? { ...x, config_value: v } : x)));
                        mark("params", p.config_key);
                      }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <CardHeader
          title="3. メンバーマスタ（権限・基本給）"
          description="01_M_メンバー。email は本番ログイン（Googleアカウント）との紐付けに使います"
          action={
            <Button size="sm" variant="secondary" onClick={addMember}>
              <Plus size={14} />
              メンバー追加
            </Button>
          }
        />
        <div className={T.wrap}>
          <table className={T.table}>
            <thead className={T.thead}>
              <tr>
                <th className={T.th}>ID</th>
                <th className={T.th}>氏名</th>
                <th className={T.th}>所属</th>
                <th className={T.th}>権限</th>
                <th className={cn(T.th, "text-right")}>基本給</th>
                <th className={T.th}>email</th>
                <th className={T.th}>在籍</th>
              </tr>
            </thead>
            <tbody className={T.tbody}>
              {members.map((m) => (
                <tr key={m.member_id} className={cn(T.tr, dirty.members.has(m.member_id) && "bg-warn/10", !m.is_active && "opacity-60")}>
                  <td className={cn(T.td, "font-mono text-muted")}>{m.member_id}</td>
                  <td className={T.td}>
                    <input className={txtCls} value={m.name} onChange={(e) => updMember(m.member_id, { name: e.target.value })} placeholder="氏名" />
                  </td>
                  <td className={T.td}>
                    <select className={txtCls} value={m.department} onChange={(e) => updMember(m.member_id, { department: e.target.value as Member["department"] })}>
                      {ALL_DEPTS.map((d) => (
                        <option key={d} value={d}>
                          {DEPT_META[d].short}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className={T.td}>
                    <select className={txtCls} value={m.role} onChange={(e) => updMember(m.member_id, { role: e.target.value as Member["role"] })}>
                      <option value="ADMIN">ADMIN（本部）</option>
                      <option value="LEADER">LEADER（統括）</option>
                      <option value="MEMBER">MEMBER（一般）</option>
                    </select>
                  </td>
                  <td className={cn(T.td, "text-right")}>
                    <input type="number" className={numCls} value={m.base_salary} onChange={(e) => updMember(m.member_id, { base_salary: Number(e.target.value) })} />
                  </td>
                  <td className={T.td}>
                    <input className={cn(txtCls, "min-w-44")} value={m.email} onChange={(e) => updMember(m.member_id, { email: e.target.value })} placeholder="name@gooner.space" />
                  </td>
                  <td className={T.td}>
                    <input type="checkbox" checked={m.is_active} onChange={(e) => updMember(m.member_id, { is_active: e.target.checked })} />
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

function fillPlans(existing: MonthlyPlan[]): MonthlyPlan[] {
  const out: MonthlyPlan[] = [];
  for (const m of TERM_MONTHS)
    for (const d of BUSINESS_DEPTS) {
      out.push(existing.find((p) => p.year_month === m.key && p.department === d) ?? { plan_id: `${m.key}_${d}`, year_month: m.key, department: d, target_sales: 0, target_op: 0 });
    }
  return out;
}

function FragmentHeaders() {
  return (
    <>
      <th className={cn(T.th, "text-right")}>売上</th>
      <th className={cn(T.th, "text-right")}>営業利益</th>
    </>
  );
}

function FragmentTotals({ s, o }: { s: number; o: number }) {
  return (
    <>
      <td className={cn(T.num)}>{yen(s)}</td>
      <td className={cn(T.num, "text-good")}>{yen(o)}</td>
    </>
  );
}

function PlanCells({ p, onChange, dirty }: { p: MonthlyPlan; onChange: (f: "target_sales" | "target_op", v: number) => void; dirty: boolean }) {
  return (
    <>
      <td className={cn("px-2 py-1.5 text-right", dirty && "bg-warn/10")}>
        <input type="number" className={numCls} value={p.target_sales} onChange={(e) => onChange("target_sales", Number(e.target.value))} />
      </td>
      <td className={cn("px-2 py-1.5 text-right", dirty && "bg-warn/10")}>
        <input type="number" className={cn(numCls, "text-good")} value={p.target_op} onChange={(e) => onChange("target_op", Number(e.target.value))} />
      </td>
    </>
  );
}
