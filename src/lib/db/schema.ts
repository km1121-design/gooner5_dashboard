import type { Database } from "../types";

// スプレッドシートの各シート定義。1行目をヘッダー行とし、列名で読み書きする（列の並び替えに強い）。

type ColType = "string" | "number" | "boolean";

export interface SheetDef<K extends keyof Database> {
  key: K;
  sheet: string;
  idColumn: string;
  columns: Record<string, ColType>;
}

export const SHEETS: { [K in keyof Database]: SheetDef<K> } = {
  members: {
    key: "members",
    sheet: "01_M_メンバー",
    idColumn: "member_id",
    columns: { member_id: "string", name: "string", department: "string", role: "string", base_salary: "number", is_active: "boolean", email: "string" },
  },
  plans: {
    key: "plans",
    sheet: "02_M_事業計画",
    idColumn: "plan_id",
    columns: { plan_id: "string", year_month: "string", department: "string", target_sales: "number", target_op: "number" },
  },
  params: {
    key: "params",
    sheet: "03_M_設定パラメータ",
    idColumn: "config_key",
    columns: { config_key: "string", config_value: "number", description: "string" },
  },
  transactions: {
    key: "transactions",
    sheet: "04_T_売上実績",
    idColumn: "tx_id",
    columns: {
      tx_id: "string", year_month: "string", date: "string", department: "string", member_id: "string",
      category: "string", title: "string", gross_sales: "number", direct_cost: "number", lead_source: "string",
      notes: "string", status: "string", created_by: "string", created_at: "string", approved_by: "string", approved_at: "string",
    },
  },
  expenses: {
    key: "expenses",
    sheet: "05_T_経費実績",
    idColumn: "exp_id",
    columns: { exp_id: "string", year_month: "string", department: "string", category: "string", amount: "number", description: "string" },
  },
  referrals: {
    key: "referrals",
    sheet: "06_T_リファーラル",
    idColumn: "ref_id",
    columns: {
      ref_id: "string", year_month: "string", from_member_id: "string", to_dept: "string",
      client_name: "string", gross_amount: "number", split_rate: "number", status: "string",
    },
  },
};

export type TableKey = keyof Database;
export type Row<K extends TableKey> = Database[K][number];

export function parseCell(v: unknown, t: ColType): string | number | boolean {
  if (t === "number") {
    const n = Number(String(v ?? "").replace(/[¥,\s]/g, ""));
    return Number.isFinite(n) ? n : 0;
  }
  if (t === "boolean") return String(v).toUpperCase() === "TRUE" || v === true || v === "1";
  return v == null ? "" : String(v);
}

export function rowsToObjects<K extends TableKey>(def: SheetDef<K>, values: unknown[][]): Row<K>[] {
  if (!values.length) return [];
  const header = values[0].map((h) => String(h).trim());
  const out: Row<K>[] = [];
  for (const raw of values.slice(1)) {
    if (!raw.some((c) => c !== "" && c != null)) continue;
    const obj: Record<string, unknown> = {};
    for (const [col, t] of Object.entries(def.columns)) {
      const idx = header.indexOf(col);
      // 追加列（status等）が無い既存シートでも動くよう、未定義列は既定値で補完
      obj[col] = parseCell(idx >= 0 ? raw[idx] : defaultFor(def.key, col), t);
    }
    out.push(obj as unknown as Row<K>);
  }
  return out;
}

function defaultFor(key: TableKey, col: string): unknown {
  if (col === "status" && (key === "transactions" || key === "referrals")) return "APPROVED";
  if (col === "is_active") return "TRUE";
  return "";
}

export function objectToRow<K extends TableKey>(def: SheetDef<K>, header: string[], obj: Row<K>): (string | number | boolean)[] {
  const rec = obj as unknown as Record<string, unknown>;
  return header.map((h) => {
    const v = rec[h];
    if (v === undefined || v === null) return "";
    if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
    return v as string | number;
  });
}
