// CSV 取り込みの検証・変換（純粋関数）。scripts/import-csv.ts から使う。
import { ALL_DEPTS, BUSINESS_DEPTS } from "../constants";
import type { ConfigParam, CrossReferral, Database, ExpenseTransaction, Member, MonthlyPlan, SalesTransaction } from "../types";
import type { TableKey } from "./schema";

export interface ImportResult<T> {
  rows: T[];
  errors: string[];
  /** 追加（append）か、主キーで上書き（upsert）か */
  mode: "append" | "upsert";
}

const YMD = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const validDate = (d: string) => YMD.test(d) && new Date(`${d}T00:00:00Z`).toISOString().slice(0, 10) === d;
const YM = /^\d{4}-(0[1-9]|1[0-2])$/;

/** "¥1,234" "12%" "1234" などを数値に。空欄は undefined */
export function parseNumber(v: string | undefined): number | undefined {
  if (v === undefined || v.trim() === "") return undefined;
  const s = v.replace(/[¥,\s円]/g, "");
  const pct = s.endsWith("%");
  const n = Number(pct ? s.slice(0, -1) : s);
  if (!Number.isFinite(n)) return NaN;
  return pct ? n / 100 : n;
}

/** 2026/8/5 → 2026-08-05 のような表記ゆれを吸収 */
export function normalizeDate(v: string): string {
  const m = v.trim().match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  return m ? `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}` : v.trim();
}

export function normalizeMonth(v: string): string {
  const m = v.trim().match(/^(\d{4})[-/.](\d{1,2})$/);
  return m ? `${m[1]}-${m[2].padStart(2, "0")}` : v.trim();
}

function nextIdFactory(existing: string[], prefix: string) {
  let max = 0;
  for (const id of existing) {
    const m = id.match(new RegExp(`^${prefix}_(\\d+)$`));
    if (m) max = Math.max(max, Number(m[1]));
  }
  return () => `${prefix}_${String(++max).padStart(4, "0")}`;
}

type Rec = Record<string, string>;

export function prepareImport(table: TableKey, records: Rec[], db: Database, now = new Date().toISOString()): ImportResult<unknown> {
  const errors: string[] = [];
  const err = (i: number, msg: string) => errors.push(`${i + 2}行目: ${msg}`);
  const memberIds = new Set(db.members.map((m) => m.member_id));
  const num = (i: number, r: Rec, col: string, required = true): number => {
    const n = parseNumber(r[col]);
    if (n === undefined) {
      if (required) err(i, `${col} が空です`);
      return 0;
    }
    if (Number.isNaN(n)) err(i, `${col} が数値ではありません（${r[col]}）`);
    return n;
  };

  switch (table) {
    case "transactions": {
      const newId = nextIdFactory(db.transactions.map((t) => t.tx_id), "TX");
      const existing = new Set(db.transactions.map((t) => t.tx_id));
      const rows: SalesTransaction[] = records.map((r, i) => {
        const date = normalizeDate(r.date ?? "");
        if (!validDate(date)) err(i, `date は YYYY-MM-DD 形式で入力してください（${r.date ?? ""}）`);
        const dept = r.department as SalesTransaction["department"];
        if (!BUSINESS_DEPTS.includes(dept)) err(i, `department は ${BUSINESS_DEPTS.join("/")} のいずれかです（${r.department ?? ""}）`);
        if (!memberIds.has(r.member_id)) err(i, `member_id ${r.member_id || "(空)"} がメンバーマスタにありません`);
        if (!r.category) err(i, "category が空です");
        if (!r.title) err(i, "title が空です");
        const lead = (r.lead_source || "DIRECT").toUpperCase() as SalesTransaction["lead_source"];
        if (!["DIRECT", "AD", "REFERRAL"].includes(lead)) err(i, `lead_source は DIRECT/AD/REFERRAL のいずれかです（${r.lead_source}）`);
        const status = (r.status || "APPROVED").toUpperCase() as SalesTransaction["status"];
        if (!["APPROVED", "PENDING", "REJECTED"].includes(status)) err(i, `status が不正です（${r.status}）`);
        if (r.tx_id && existing.has(r.tx_id)) err(i, `tx_id ${r.tx_id} は既に登録されています`);
        return {
          tx_id: r.tx_id || newId(),
          year_month: date.slice(0, 7),
          date,
          department: dept,
          member_id: r.member_id,
          category: r.category,
          title: r.title,
          gross_sales: num(i, r, "gross_sales"),
          direct_cost: num(i, r, "direct_cost", false),
          lead_source: lead,
          notes: r.notes ?? "",
          status,
          created_by: r.created_by || "IMPORT",
          created_at: r.created_at || now,
          approved_by: status === "APPROVED" ? r.approved_by || "IMPORT" : "",
          approved_at: status === "APPROVED" ? r.approved_at || now : "",
        };
      });
      return { rows, errors, mode: "append" };
    }
    case "expenses": {
      const newId = nextIdFactory(db.expenses.map((e) => e.exp_id), "EXP");
      const rows: ExpenseTransaction[] = records.map((r, i) => {
        const ym = normalizeMonth(r.year_month ?? "");
        if (!YM.test(ym)) err(i, `year_month は YYYY-MM 形式で入力してください（${r.year_month ?? ""}）`);
        if (!ALL_DEPTS.includes(r.department as never)) err(i, `department は ${ALL_DEPTS.join("/")} のいずれかです`);
        if (!r.category) err(i, "category が空です");
        return {
          exp_id: r.exp_id || newId(),
          year_month: ym,
          department: r.department as ExpenseTransaction["department"],
          category: r.category,
          amount: num(i, r, "amount"),
          description: r.description ?? "",
        };
      });
      return { rows, errors, mode: "append" };
    }
    case "referrals": {
      const newId = nextIdFactory(db.referrals.map((x) => x.ref_id), "REF");
      const rows: CrossReferral[] = records.map((r, i) => {
        const ym = normalizeMonth(r.year_month ?? "");
        if (!YM.test(ym)) err(i, `year_month は YYYY-MM 形式で入力してください`);
        if (!memberIds.has(r.from_member_id)) err(i, `from_member_id ${r.from_member_id || "(空)"} がメンバーマスタにありません`);
        if (!["SALES", "HR", "LOGI", "EXTERNAL"].includes(r.to_dept)) err(i, "to_dept は SALES/HR/LOGI/EXTERNAL のいずれかです");
        const split = num(i, r, "split_rate");
        if (split < 0 || split > 1) err(i, `split_rate は 0〜1（または 0%〜100%）です（${r.split_rate}）`);
        return {
          ref_id: r.ref_id || newId(),
          year_month: ym,
          from_member_id: r.from_member_id,
          to_dept: r.to_dept as CrossReferral["to_dept"],
          client_name: r.client_name ?? "",
          gross_amount: num(i, r, "gross_amount"),
          split_rate: split,
          status: ((r.status || "APPROVED").toUpperCase() as CrossReferral["status"]),
        };
      });
      return { rows, errors, mode: "append" };
    }
    case "plans": {
      const rows: MonthlyPlan[] = records.map((r, i) => {
        const ym = normalizeMonth(r.year_month ?? "");
        if (!YM.test(ym)) err(i, `year_month は YYYY-MM 形式で入力してください`);
        if (!ALL_DEPTS.includes(r.department as never)) err(i, `department は ${ALL_DEPTS.join("/")} のいずれかです`);
        return {
          plan_id: `${ym}_${r.department}`,
          year_month: ym,
          department: r.department as MonthlyPlan["department"],
          target_sales: num(i, r, "target_sales"),
          target_op: num(i, r, "target_op"),
        };
      });
      return { rows, errors, mode: "upsert" };
    }
    case "members": {
      const rows: Member[] = records.map((r, i) => {
        if (!r.member_id) err(i, "member_id が空です");
        if (!r.name) err(i, "name が空です");
        if (!ALL_DEPTS.includes(r.department as never)) err(i, `department は ${ALL_DEPTS.join("/")} のいずれかです`);
        const role = (r.role || "MEMBER").toUpperCase() as Member["role"];
        if (!["ADMIN", "LEADER", "MEMBER"].includes(role)) err(i, "role は ADMIN/LEADER/MEMBER のいずれかです");
        if (r.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(r.email)) err(i, `email の形式が不正です（${r.email}）`);
        return {
          member_id: r.member_id,
          name: r.name,
          department: r.department as Member["department"],
          role,
          base_salary: num(i, r, "base_salary", false),
          is_active: !/^(false|0|no|退職)$/i.test(r.is_active ?? ""),
          email: (r.email ?? "").trim(),
        };
      });
      return { rows, errors, mode: "upsert" };
    }
    case "params": {
      const rows: ConfigParam[] = records.map((r, i) => {
        if (!r.config_key) err(i, "config_key が空です");
        return { config_key: r.config_key, config_value: num(i, r, "config_value"), description: r.description ?? "" };
      });
      return { rows, errors, mode: "upsert" };
    }
  }
}
