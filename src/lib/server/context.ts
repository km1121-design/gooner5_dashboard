import "server-only";
import { authMode, getCurrentUser } from "../auth";
import { getRepository } from "../db/repository";
import type { Database, Member } from "../types";

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** 日本時間の今日（YYYY-MM-DD）。APP_TODAY でデモ用に固定可能 */
export function todayJST(): string {
  if (process.env.APP_TODAY) return process.env.APP_TODAY;
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Tokyo" }).format(new Date());
}

export function nowISO(): string {
  return new Date().toISOString();
}

export async function requireUser(): Promise<{ db: Database; me: Member }> {
  const db = await getRepository().load();
  const me = await getCurrentUser(db);
  if (!me) {
    const mode = authMode();
    throw new HttpError(
      401,
      mode === "google" ? "ログインしてください" : mode === "dev" ? "メンバーが登録されていません" : "認証が設定されていません（README のログイン設定を確認してください）",
    );
  }
  return { db, me };
}

export function handle(fn: () => Promise<Response>): Promise<Response> {
  return fn().catch((e: unknown) => {
    if (e instanceof HttpError) return Response.json({ error: e.message }, { status: e.status });
    console.error(e);
    return Response.json({ error: e instanceof Error ? e.message : "Internal error" }, { status: 500 });
  });
}

// ---- 入力バリデーション
export function str(v: unknown, name: string, opts: { required?: boolean; max?: number } = {}): string {
  const s = v == null ? "" : String(v).trim();
  if (opts.required && !s) throw new HttpError(400, `${name} は必須です`);
  if (s.length > (opts.max ?? 200)) throw new HttpError(400, `${name} が長すぎます`);
  return s;
}

export function num(v: unknown, name: string, opts: { min?: number; max?: number } = {}): number {
  const n = Number(v);
  if (!Number.isFinite(n)) throw new HttpError(400, `${name} は数値で入力してください`);
  if (opts.min !== undefined && n < opts.min) throw new HttpError(400, `${name} は ${opts.min} 以上で入力してください`);
  if (opts.max !== undefined && n > opts.max) throw new HttpError(400, `${name} は ${opts.max} 以下で入力してください`);
  return n;
}

export function oneOf<T extends string>(v: unknown, values: readonly T[], name: string): T {
  if (!values.includes(v as T)) throw new HttpError(400, `${name} が不正です`);
  return v as T;
}

export function ymd(v: unknown, name: string): string {
  const s = str(v, name, { required: true });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || Number.isNaN(Date.parse(s))) throw new HttpError(400, `${name} は YYYY-MM-DD 形式で入力してください`);
  return s;
}

export function ym(v: unknown, name: string): string {
  const s = str(v, name, { required: true });
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(s)) throw new HttpError(400, `${name} は YYYY-MM 形式で入力してください`);
  return s;
}
