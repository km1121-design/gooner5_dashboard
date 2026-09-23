// セッション・OAuth state の署名と検証（HS256 JWT）。Next.js に依存しない純粋なモジュール。
import { jwtVerify, SignJWT } from "jose";

export const SESSION_DAYS = 14;

function key(secret: string) {
  if (!secret || secret.length < 32) throw new Error("AUTH_SECRET は32文字以上で設定してください");
  return new TextEncoder().encode(secret);
}

export interface SessionPayload {
  /** member_id */
  sub: string;
  email: string;
}

export async function signSession(payload: SessionPayload, secret: string, days = SESSION_DAYS): Promise<string> {
  return new SignJWT({ email: payload.email, typ: "session" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(`${days}d`)
    .sign(key(secret));
}

export async function verifySession(token: string | undefined, secret: string): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key(secret), { algorithms: ["HS256"] });
    if (payload.typ !== "session" || !payload.sub || typeof payload.email !== "string") return null;
    return { sub: payload.sub, email: payload.email };
  } catch {
    return null;
  }
}

export interface OAuthState {
  state: string;
  nonce: string;
  verifier: string;
  returnTo: string;
}

/** Google へリダイレクトする間だけ保持する state / nonce / PKCE verifier（10分有効） */
export async function signOAuthState(s: OAuthState, secret: string): Promise<string> {
  return new SignJWT({ ...s, typ: "oauth" }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("10m").sign(key(secret));
}

export async function verifyOAuthState(token: string | undefined, secret: string): Promise<OAuthState | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key(secret), { algorithms: ["HS256"] });
    if (payload.typ !== "oauth") return null;
    const { state, nonce, verifier, returnTo } = payload as unknown as OAuthState;
    return { state, nonce, verifier, returnTo };
  } catch {
    return null;
  }
}

/** ログイン後の戻り先。オープンリダイレクト防止のため同一サイト内の相対パスのみ許可 */
export function safeReturnTo(v: string | null | undefined): string {
  if (!v || !v.startsWith("/") || v.startsWith("//") || v.startsWith("/\\")) return "/";
  return v;
}

export function randomToken(bytes = 32): string {
  const a = new Uint8Array(bytes);
  crypto.getRandomValues(a);
  return base64url(a);
}

export function base64url(a: Uint8Array): string {
  let s = "";
  for (const b of a) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function pkceChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return base64url(new Uint8Array(digest));
}

/** メンバー表のメールと Google アカウントのメールを突合（大文字小文字・前後空白を無視） */
export function normalizeEmail(e: string): string {
  return e.trim().toLowerCase();
}
