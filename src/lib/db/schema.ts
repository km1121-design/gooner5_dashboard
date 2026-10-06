import type { Database } from "../types";

// スプレッドシートの各シート定義。
// 1行目を見出し行とし、列名で読み書きする（列の並び替えに強い）。
// 見出し・区分値はスプレッドシート上では日本語で表示し、アプリ内部では英語のコードで扱う。
// 読み込み時は日本語・英語どちらの見出し／値も受け付ける（旧形式のシートとの互換のため）。

type ColType = "string" | "number" | "boolean";

/** 区分値の 内部コード ⇔ シート表示 の対応 */
export const ENUM_LABELS = {
  department: { SALES: "イベント営業", HR: "人材", LOGI: "運送", HQ: "本部", EXTERNAL: "社外" },
  role: { ADMIN: "本部管理者", LEADER: "統括", MEMBER: "一般" },
  lead_source: { DIRECT: "直接・自社", AD: "広告", REFERRAL: "リファーラル" },
  status: { PENDING: "承認待ち", APPROVED: "確定", REJECTED: "差戻し" },
} as const;

type EnumName = keyof typeof ENUM_LABELS;

/** 列ごとに使う区分値の種類 */
const COLUMN_ENUM: Record<string, EnumName> = {
  department: "department",
  to_dept: "department",
  role: "role",
  lead_source: "lead_source",
  status: "status",
};

export interface SheetDef<K extends keyof Database> {
  key: K;
  sheet: string;
  idColumn: string;
  columns: Record<string, ColType>;
  /** シートに表示する日本語の見出し */
  labels: Record<string, string>;
}

export const SHEETS: { [K in keyof Database]: SheetDef<K> } = {
  members: {
    key: "members",
    sheet: "01_M_メンバー",
    idColumn: "member_id",
    columns: { member_id: "string", name: "string", department: "string", role: "string", base_salary: "number", is_active: "boolean", email: "string" },
    labels: { member_id: "メンバーID", name: "氏名", department: "所属", role: "権限", base_salary: "基本給", is_active: "在籍", email: "メールアドレス" },
  },
  plans: {
    key: "plans",
    sheet: "02_M_事業計画",
    idColumn: "plan_id",
    columns: { plan_id: "string", year_month: "string", department: "string", target_sales: "number", target_op: "number" },
    labels: { plan_id: "計画ID", year_month: "対象年月", department: "事業部", target_sales: "目標売上", target_op: "目標営業利益" },
  },
  params: {
    key: "params",
    sheet: "03_M_設定パラメータ",
    idColumn: "config_key",
    columns: { config_key: "string", config_value: "number", description: "string" },
    labels: { config_key: "設定キー", config_value: "設定値", description: "説明" },
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
    labels: {
      tx_id: "伝票ID", year_month: "計上年月", date: "計上日", department: "事業部", member_id: "担当者ID",
      category: "区分", title: "案件内容", gross_sales: "売上金額", direct_cost: "直接経費", lead_source: "流入経路",
      notes: "備考", status: "ステータス", created_by: "登録者ID", created_at: "登録日時", approved_by: "承認者ID", approved_at: "承認日時",
    },
  },
  expenses: {
    key: "expenses",
    sheet: "05_T_経費実績",
    idColumn: "exp_id",
    columns: { exp_id: "string", year_month: "string", department: "string", category: "string", amount: "number", description: "string" },
    labels: { exp_id: "経費ID", year_month: "対象年月", department: "事業部", category: "科目", amount: "金額", description: "摘要" },
  },
  referrals: {
    key: "referrals",
    sheet: "06_T_リファーラル",
    idColumn: "ref_id",
    columns: {
      ref_id: "string", year_month: "string", from_member_id: "string", to_dept: "string",
      client_name: "string", gross_amount: "number", split_rate: "number", status: "string",
    },
    labels: {
      ref_id: "送客ID", year_month: "対象年月", from_member_id: "紹介元担当者ID", to_dept: "送客先",
      client_name: "案件名", gross_amount: "成立総売上", split_rate: "紹介元配分率", status: "ステータス",
    },
  },
};

export type TableKey = keyof Database;
export type Row<K extends TableKey> = Database[K][number];

// ---------------------------------------------------------------- 見出し

/** シートに書き出す見出し行（日本語） */
export function headerLabels(def: SheetDef<TableKey>): string[] {
  return Object.keys(def.columns).map((c) => def.labels[c] ?? c);
}

/** 見出しセル（日本語でも英語でも可）→ 内部の列名 */
export function columnKeyOf(def: SheetDef<TableKey>, header: string): string | undefined {
  const h = String(header).trim();
  if (h in def.columns) return h;
  return Object.keys(def.labels).find((k) => def.labels[k] === h);
}

/** 列名の位置（見出しが日本語でも英語でも探す）。無ければ -1 */
export function colIndex(def: SheetDef<TableKey>, header: string[], key: string): number {
  return header.findIndex((h) => columnKeyOf(def, h) === key);
}

/** シートに不足している列（日本語の見出しで返す） */
export function missingColumns(def: SheetDef<TableKey>, header: string[]): string[] {
  return Object.keys(def.columns)
    .filter((k) => colIndex(def, header, k) < 0)
    .map((k) => def.labels[k] ?? k);
}

// ---------------------------------------------------------------- 値の変換

/** シート上の値（日本語の区分名でもコードでも可）→ 内部コード */
export function decodeEnum(column: string, v: unknown): unknown {
  const name = COLUMN_ENUM[column];
  if (!name || v == null) return v;
  const s = String(v).trim();
  const map = ENUM_LABELS[name] as Record<string, string>;
  if (s in map) return s;
  const hit = Object.entries(map).find(([, label]) => label === s);
  return hit ? hit[0] : s;
}

/** 内部コード → シート表示用の日本語 */
export function encodeEnum(column: string, v: unknown): unknown {
  const name = COLUMN_ENUM[column];
  if (!name || v == null) return v;
  const map = ENUM_LABELS[name] as Record<string, string>;
  return map[String(v)] ?? v;
}

export function parseCell(v: unknown, t: ColType): string | number | boolean {
  if (t === "number") {
    const n = Number(String(v ?? "").replace(/[¥,\s円]/g, ""));
    return Number.isFinite(n) ? n : 0;
  }
  if (t === "boolean") {
    if (v === true) return true;
    const s = String(v ?? "").trim().toUpperCase();
    return ["TRUE", "1", "在籍", "○", "はい", "YES"].includes(s);
  }
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
      const idx = colIndex(def as SheetDef<TableKey>, header, col);
      // 追加列（status等）が無い既存シートでも動くよう、未定義列は既定値で補完
      obj[col] = parseCell(decodeEnum(col, idx >= 0 ? raw[idx] : defaultFor(def.key, col)), t);
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

/** オブジェクト → シートの1行（見出しの並びに合わせ、区分値は日本語で書く） */
export function objectToRow<K extends TableKey>(def: SheetDef<K>, header: string[], obj: Row<K>): (string | number | boolean)[] {
  const rec = obj as unknown as Record<string, unknown>;
  return header.map((h) => {
    const key = columnKeyOf(def as SheetDef<TableKey>, h);
    if (!key) return "";
    const v = encodeEnum(key, rec[key]);
    if (v === undefined || v === null) return "";
    if (typeof v === "boolean") return v;
    return v as string | number;
  });
}

/** CSV の1行（日本語・英語どちらの見出し／区分値でも可）を内部の列名・コードにそろえる */
export function normalizeRecord(def: SheetDef<TableKey>, rec: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [h, v] of Object.entries(rec)) {
    const key = columnKeyOf(def, h) ?? h;
    out[key] = String(decodeEnum(key, v) ?? "");
  }
  return out;
}
