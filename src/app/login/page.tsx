import { redirect } from "next/navigation";
import { authMode, getCurrentUser } from "@/lib/auth";
import { getRepository } from "@/lib/db/repository";

export const metadata = { title: "ログイン | Gooner 5期 PLダッシュボード" };

const ERRORS: Record<string, string> = {
  not_registered: "このGoogleアカウントはメンバー登録されていません。本部に「メンバーマスタへのメールアドレス登録」を依頼してください。",
  domain: "許可されていないドメインのアカウントです。会社のGoogleアカウントでログインしてください。",
  state: "ログインの有効期限が切れました。もう一度お試しください。",
  token: "Googleでの認証に失敗しました。もう一度お試しください。",
  cancelled: "ログインがキャンセルされました。",
};

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const mode = authMode();
  if (mode === "dev") redirect("/");
  if (mode === "google" && (await getCurrentUser(await getRepository().load()))) redirect("/");
  const sp = await searchParams;
  const error = typeof sp.error === "string" ? (ERRORS[sp.error] ?? ERRORS.token) : null;
  const loggedOut = sp.logged_out === "1";
  // 値そのものは出さず、未設定の変数名だけを示す
  const missingEnv = ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "AUTH_SECRET"].filter((k) => !process.env[k] || (k === "AUTH_SECRET" && process.env[k]!.length < 32));

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-2xl border border-line bg-surface p-8 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand text-lg font-black text-white">G</span>
          <div>
            <h1 className="text-base font-black">Gooner 第5期 PLダッシュボード</h1>
            <p className="text-xs text-muted">事業部PL・個人PL・インセンティブ管理</p>
          </div>
        </div>

        {error && <p className="mt-6 rounded-lg border border-bad/30 bg-bad/10 px-3 py-2 text-xs text-bad">{error}</p>}
        {loggedOut && !error && <p className="mt-6 rounded-lg bg-subtle px-3 py-2 text-xs text-soft">ログアウトしました。</p>}

        {mode === "google" ? (
          <a
            href="/api/auth/login"
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg border border-line bg-surface px-4 py-2.5 text-sm font-bold text-ink shadow-sm hover:bg-subtle"
          >
            <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
              <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
              <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
              <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
              <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
            </svg>
            Googleアカウントでログイン
          </a>
        ) : (
          <div className="mt-6 rounded-lg bg-subtle px-3 py-2 text-xs text-soft">
            <p>ログインが設定されていません。管理者は次の環境変数を設定してください（`npm run setup:check` で詳細を確認できます）。</p>
            <ul className="mt-2 space-y-0.5 font-mono">
              {missingEnv.map((k) => (
                <li key={k}>✗ {k}</li>
              ))}
            </ul>
          </div>
        )}
        <p className="mt-4 text-center text-[11px] text-muted">メンバーマスタに登録されたメールアドレスのアカウントのみログインできます</p>
      </div>
    </main>
  );
}
