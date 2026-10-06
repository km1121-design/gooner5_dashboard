// ブラウザだけで動くデモ版のための疑似 API。
// 本番の Route Handlers と同じ権限チェック・計算ロジック（finance-engine / view-model）を使い、
// データはブラウザのメモリ（＋可能なら localStorage）に保持する。
import { canApprove, canEditMaster, canReportFor } from "../src/lib/access";
import { ALL_DEPTS, BUSINESS_DEPTS, TERM_MONTHS } from "../src/lib/constants";
import { createSeedDatabase } from "../src/lib/seed";
import type { BusinessDept, Database, Dept, Member } from "../src/lib/types";
import { buildDashboard } from "../src/lib/view-model";

export const DEMO_TODAY = "2026-09-23";
const STORE_KEY = "gooner5-demo-db";

let db: Database = load();
let meId = "MEM_000";

function load(): Database {
  try {
    const saved = localStorage.getItem(STORE_KEY);
    if (saved) return { ...createSeedDatabase(), ...JSON.parse(saved) };
  } catch {}
  return createSeedDatabase();
}

function persist() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(db));
  } catch {}
}

export function resetDemo() {
  db = createSeedDatabase();
  meId = "MEM_000";
  try {
    localStorage.removeItem(STORE_KEY);
  } catch {}
}

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

const now = () => new Date().toISOString();
const me = (): Member => db.members.find((m) => m.member_id === meId && m.is_active) ?? db.members[0];

function nextId(existing: string[], prefix: string) {
  let max = 0;
  for (const id of existing) {
    const m = id.match(new RegExp(`^${prefix}_(\\d+)$`));
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `${prefix}_${String(max + 1).padStart(4, "0")}`;
}

function need(v: unknown, name: string): string {
  const s = v == null ? "" : String(v).trim();
  if (!s) throw new HttpError(400, `${name} は必須です`);
  return s;
}

function num(v: unknown, name: string, min = -1e12, max = 1e12): number {
  const n = Number(v);
  if (!Number.isFinite(n)) throw new HttpError(400, `${name} は数値で入力してください`);
  if (n < min || n > max) throw new HttpError(400, `${name} の範囲が不正です`);
  return n;
}

type Body = Record<string, unknown>;

function route(method: string, path: string, query: URLSearchParams, body: Body): unknown {
  const user = me();

  if (method === "GET" && path === "/api/dashboard") {
    const requested = query.get("month");
    const month = TERM_MONTHS.some((m) => m.key === requested) ? requested! : DEMO_TODAY.slice(0, 7);
    return buildDashboard(db, user, month, { today: DEMO_TODAY, dataSource: "local", authMode: "dev" });
  }

  if (method === "POST" && path === "/api/session") {
    const id = need(body.member_id, "member_id");
    if (!db.members.some((m) => m.member_id === id && m.is_active)) throw new HttpError(404, "メンバーが見つかりません");
    meId = id;
    return { ok: true };
  }

  if (method === "POST" && path === "/api/transactions") {
    const department = body.department as BusinessDept;
    if (!BUSINESS_DEPTS.includes(department)) throw new HttpError(400, "事業部が不正です");
    const target = db.members.find((m) => m.member_id === body.member_id && m.is_active);
    if (!target) throw new HttpError(400, "担当者が見つかりません");
    if (!canReportFor(user, target, department)) throw new HttpError(403, "この担当者・事業部の実績は登録できません");
    const date = need(body.date, "計上日");
    const auto = user.role === "ADMIN";
    const tx = {
      tx_id: nextId(db.transactions.map((t) => t.tx_id), "TX"),
      year_month: date.slice(0, 7),
      date,
      department,
      member_id: target.member_id,
      category: need(body.category, "区分"),
      title: need(body.title, "案件内容"),
      gross_sales: num(body.gross_sales, "売上金額", 0),
      direct_cost: num(body.direct_cost ?? 0, "直接経費", 0),
      lead_source: (body.lead_source as "DIRECT" | "AD" | "REFERRAL") ?? "DIRECT",
      notes: String(body.notes ?? ""),
      status: auto ? ("APPROVED" as const) : ("PENDING" as const),
      created_by: user.member_id,
      created_at: now(),
      approved_by: auto ? user.member_id : "",
      approved_at: auto ? now() : "",
    };
    db.transactions.push(tx);
    return { ok: true, transaction: tx };
  }

  const txMatch = path.match(/^\/api\/transactions\/([^/]+)$/);
  if (method === "PATCH" && txMatch) {
    const tx = db.transactions.find((t) => t.tx_id === txMatch[1]);
    if (!tx) throw new HttpError(404, "伝票が見つかりません");
    if (!canApprove(user, tx)) throw new HttpError(403, "この伝票を承認する権限がありません");
    const approve = body.action === "approve";
    tx.status = approve ? "APPROVED" : "REJECTED";
    tx.approved_by = user.member_id;
    tx.approved_at = now();
    const reason = String(body.reason ?? "").trim();
    if (!approve && reason) tx.notes = `${tx.notes ? tx.notes + " / " : ""}差戻し: ${reason}`;
    return { ok: true };
  }

  if (method === "POST" && path === "/api/referrals") {
    const from = db.members.find((m) => m.member_id === body.from_member_id && m.is_active);
    if (!from) throw new HttpError(400, "紹介元担当者が見つかりません");
    const allowed = user.role === "ADMIN" || from.member_id === user.member_id || (user.role === "LEADER" && from.department === user.department);
    if (!allowed) throw new HttpError(403, "この担当者のリファーラルは登録できません");
    const toDept = body.to_dept as "SALES" | "HR" | "LOGI" | "EXTERNAL";
    if (toDept === from.department) throw new HttpError(400, "送客先が紹介元と同じ事業部です");
    db.referrals.push({
      ref_id: nextId(db.referrals.map((r) => r.ref_id), "REF"),
      year_month: need(body.year_month, "対象年月"),
      from_member_id: from.member_id,
      to_dept: toDept,
      client_name: need(body.client_name, "案件名"),
      gross_amount: num(body.gross_amount, "成立総売上", 0),
      split_rate: num(body.split_rate, "紹介元配分率", 0, 1),
      status: user.role === "ADMIN" ? "APPROVED" : "PENDING",
    });
    return { ok: true };
  }

  const refMatch = path.match(/^\/api\/referrals\/([^/]+)$/);
  if (method === "PATCH" && refMatch) {
    if (user.role !== "ADMIN") throw new HttpError(403, "リファーラルの承認は本部のみ可能です");
    const ref = db.referrals.find((r) => r.ref_id === refMatch[1]);
    if (!ref) throw new HttpError(404, "リファーラルが見つかりません");
    ref.status = body.action === "approve" ? "APPROVED" : "REJECTED";
    return { ok: true };
  }

  if (method === "POST" && path === "/api/expenses") {
    const department = body.department as Dept;
    if (!ALL_DEPTS.includes(department)) throw new HttpError(400, "事業部が不正です");
    if (!(user.role === "ADMIN" || (user.role === "LEADER" && user.department === department))) throw new HttpError(403, "この事業部の経費は登録できません");
    db.expenses.push({
      exp_id: nextId(db.expenses.map((e) => e.exp_id), "EXP"),
      year_month: need(body.year_month, "対象年月"),
      department,
      category: need(body.category, "科目"),
      amount: num(body.amount, "金額"),
      description: String(body.description ?? ""),
    });
    return { ok: true };
  }

  if (method === "PUT" && path === "/api/master") {
    if (!canEditMaster(user)) throw new HttpError(403, "マスター設定を変更する権限がありません");
    const upsert = <T,>(list: T[], rows: T[], id: (r: T) => string) => {
      for (const r of rows) {
        const i = list.findIndex((x) => id(x) === id(r));
        if (i >= 0) list[i] = r;
        else list.push(r);
      }
    };
    if (Array.isArray(body.plans)) upsert(db.plans, body.plans as Database["plans"], (p) => p.plan_id);
    if (Array.isArray(body.params)) upsert(db.params, body.params as Database["params"], (p) => p.config_key);
    if (Array.isArray(body.members)) {
      const merged = [...db.members];
      upsert(merged, body.members as Member[], (m) => m.member_id);
      if (!merged.some((m) => m.role === "ADMIN" && m.is_active)) throw new HttpError(400, "有効な ADMIN が1名以上必要です");
      db.members = merged;
    }
    return { ok: true };
  }

  throw new HttpError(404, "Not found");
}

/** window.fetch の /api/* をこの疑似 API に向ける */
export function installMockApi() {
  const realFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url, location.href);
    if (!url.pathname.startsWith("/api/")) return realFetch(input, init);
    const method = (init?.method ?? "GET").toUpperCase();
    let body: Body = {};
    try {
      body = init?.body ? JSON.parse(String(init.body)) : {};
    } catch {}
    await new Promise((r) => setTimeout(r, 80)); // 通信している雰囲気だけ再現
    try {
      const result = route(method, url.pathname, url.searchParams, body);
      if (method !== "GET") persist();
      return new Response(JSON.stringify(result), { status: 200, headers: { "Content-Type": "application/json" } });
    } catch (e) {
      const status = e instanceof HttpError ? e.status : 500;
      return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), { status, headers: { "Content-Type": "application/json" } });
    }
  };
}
