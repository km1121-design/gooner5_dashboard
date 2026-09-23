import { createRemoteJWKSet, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { authMode, authSecret, cookieSecure, findMemberByEmail, OAUTH_COOKIE, SESSION_COOKIE } from "@/lib/auth";
import { getRepository } from "@/lib/db/repository";
import { SESSION_DAYS, signSession, verifyOAuthState } from "@/lib/session";
import { loginRedirect, redirectUri } from "../shared";

const GOOGLE_JWKS = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));

// Google からの戻り: 認可コードを ID トークンに交換し、メンバー表のメールと突合してセッションを発行
export async function GET(request: Request) {
  if (authMode() !== "google") return Response.redirect(new URL("/", request.url), 303);
  const url = new URL(request.url);
  const store = await cookies();
  const saved = await verifyOAuthState(store.get(OAUTH_COOKIE)?.value, authSecret());
  store.delete({ name: OAUTH_COOKIE, path: "/api/auth" });

  if (url.searchParams.get("error")) return loginRedirect(request, "cancelled");
  const code = url.searchParams.get("code");
  if (!saved || !code || url.searchParams.get("state") !== saved.state) return loginRedirect(request, "state");

  try {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        redirect_uri: redirectUri(request),
        grant_type: "authorization_code",
        code_verifier: saved.verifier,
      }),
    });
    const tokens = (await res.json()) as { id_token?: string; error?: string };
    if (!res.ok || !tokens.id_token) {
      console.error("Google token exchange failed", tokens.error);
      return loginRedirect(request, "token");
    }

    const { payload } = await jwtVerify(tokens.id_token, GOOGLE_JWKS, {
      issuer: ["https://accounts.google.com", "accounts.google.com"],
      audience: process.env.GOOGLE_CLIENT_ID!,
    });
    const email = typeof payload.email === "string" ? payload.email : "";
    if (payload.nonce !== saved.nonce || !email || payload.email_verified !== true) return loginRedirect(request, "token");
    const domain = process.env.AUTH_ALLOWED_DOMAIN;
    if (domain && !email.toLowerCase().endsWith(`@${domain.toLowerCase()}`)) return loginRedirect(request, "domain");

    const member = findMemberByEmail(await getRepository().load(), email);
    if (!member) return loginRedirect(request, "not_registered");

    const session = await signSession({ sub: member.member_id, email }, authSecret());
    store.set(SESSION_COOKIE, session, { httpOnly: true, sameSite: "lax", secure: cookieSecure(), path: "/", maxAge: SESSION_DAYS * 86400 });
    const base = (process.env.APP_URL ?? url.origin).replace(/\/$/, "");
    return Response.redirect(`${base}${saved.returnTo}`, 303);
  } catch (e) {
    console.error("Google login failed", e);
    return loginRedirect(request, "token");
  }
}
