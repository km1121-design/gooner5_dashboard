/** Google Cloud Console に登録するリダイレクトURI（APP_URL を設定するとその値を優先） */
export function redirectUri(request: Request): string {
  const base = process.env.APP_URL ?? new URL(request.url).origin;
  return `${base.replace(/\/$/, "")}/api/auth/callback`;
}

export function loginRedirect(request: Request, error: string): Response {
  const base = process.env.APP_URL ?? new URL(request.url).origin;
  return Response.redirect(`${base.replace(/\/$/, "")}/login?error=${encodeURIComponent(error)}`, 303);
}
