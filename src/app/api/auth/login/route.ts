import { cookies } from "next/headers";
import { authMode, authSecret, cookieSecure, OAUTH_COOKIE } from "@/lib/auth";
import { pkceChallenge, randomToken, safeReturnTo, signOAuthState } from "@/lib/session";
import { redirectUri } from "../shared";

// Google ログイン開始: state / nonce / PKCE を発行して Google の同意画面へリダイレクト
export async function GET(request: Request) {
  if (authMode() !== "google") return Response.redirect(new URL("/", request.url), 303);
  const url = new URL(request.url);
  const state = randomToken();
  const nonce = randomToken();
  const verifier = randomToken(48);
  const token = await signOAuthState({ state, nonce, verifier, returnTo: safeReturnTo(url.searchParams.get("returnTo")) }, authSecret());
  (await cookies()).set(OAUTH_COOKIE, token, { httpOnly: true, sameSite: "lax", secure: cookieSecure(), path: "/api/auth", maxAge: 600 });

  const auth = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  auth.search = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: redirectUri(request),
    response_type: "code",
    scope: "openid email profile",
    state,
    nonce,
    code_challenge: await pkceChallenge(verifier),
    code_challenge_method: "S256",
    prompt: "select_account",
    ...(process.env.AUTH_ALLOWED_DOMAIN ? { hd: process.env.AUTH_ALLOWED_DOMAIN } : {}),
  }).toString();
  return Response.redirect(auth.toString(), 303);
}
