import "server-only";
import { cookies } from "next/headers";
import type { Database, Member } from "./types";

// 認証。現状は開発用の「視点切替」（cookie にメンバーIDを保持）のみ。
// 本番では Google ログイン（Auth.js 等）でメールアドレス → 01_M_メンバー.email を突合する想定。
// AUTH_MODE=dev のとき（NODE_ENV!=production の既定）だけ視点切替を許可する。

export const SESSION_COOKIE = "gooner_uid";

export function authMode(): "dev" | "locked" {
  const mode = process.env.AUTH_MODE ?? (process.env.NODE_ENV === "production" ? "locked" : "dev");
  return mode === "dev" ? "dev" : "locked";
}

export async function getCurrentUser(db: Database): Promise<Member | null> {
  // cookie は署名されておらず改ざん可能なため、dev モード以外では信用しない（本番認証の導入が前提）
  if (authMode() !== "dev") return null;
  const store = await cookies();
  const id = store.get(SESSION_COOKIE)?.value;
  const active = db.members.filter((m) => m.is_active);
  const found = active.find((m) => m.member_id === id);
  return found ?? active.find((m) => m.role === "ADMIN") ?? active[0] ?? null;
}
