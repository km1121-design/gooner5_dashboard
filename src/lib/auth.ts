import "server-only";
import { cookies } from "next/headers";
import { normalizeEmail, verifySession } from "./session";
import type { Database, Member } from "./types";
import type { AuthMode } from "./view-model";

// 認証モード
//   google : Google ログイン（本番）。GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / AUTH_SECRET が必要
//   dev    : 開発・デモ用の視点切替（cookie にメンバーIDを保持、署名なし）
//   locked : 認証未設定の本番。誰もログインできない（安全側）
// AUTH_MODE 未指定時: Google の設定があれば google、無ければ開発環境は dev、本番は locked。

export const SESSION_COOKIE = "gooner_session";
export const DEV_COOKIE = "gooner_uid";
export const OAUTH_COOKIE = "gooner_oauth";

export function googleConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.AUTH_SECRET);
}

export function authMode(): AuthMode {
  const explicit = process.env.AUTH_MODE;
  if (explicit === "dev" || explicit === "google" || explicit === "locked") return explicit;
  if (googleConfigured()) return "google";
  return process.env.NODE_ENV === "production" ? "locked" : "dev";
}

export function authSecret(): string {
  const s = process.env.AUTH_SECRET ?? "";
  if (s.length < 32) throw new Error("AUTH_SECRET は32文字以上で設定してください");
  return s;
}

export function cookieSecure(): boolean {
  return process.env.NODE_ENV === "production";
}

export async function getCurrentUser(db: Database): Promise<Member | null> {
  const mode = authMode();
  const store = await cookies();
  const active = db.members.filter((m) => m.is_active);

  if (mode === "google") {
    const session = await verifySession(store.get(SESSION_COOKIE)?.value, authSecret());
    if (!session) return null;
    // 退職（is_active=FALSE）やメール変更をすれば、既存セッションも即座に無効になる
    return active.find((m) => m.member_id === session.sub && m.email && normalizeEmail(m.email) === normalizeEmail(session.email)) ?? null;
  }

  if (mode === "dev") {
    const id = store.get(DEV_COOKIE)?.value;
    return active.find((m) => m.member_id === id) ?? active.find((m) => m.role === "ADMIN") ?? active[0] ?? null;
  }

  return null;
}

/** Google アカウントのメールから在籍メンバーを探す */
export function findMemberByEmail(db: Database, email: string): Member | undefined {
  const e = normalizeEmail(email);
  return db.members.find((m) => m.is_active && m.email && normalizeEmail(m.email) === e);
}
