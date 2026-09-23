// 本番設定の自動チェック: npm run setup:check
// 環境変数・スプレッドシート接続・シート構成・ログイン可能な ADMIN の有無などを一括で確認する。
import { SHEETS, type TableKey } from "../src/lib/db/schema";
import { rowsToObjects } from "../src/lib/db/schema";
import type { Member } from "../src/lib/types";
import { loadEnv, ng, ok, serviceAccount, sheetsClient, warn } from "./lib";

async function main() {
  loadEnv();
  const env = process.env;
  let failures = 0;
  const fail = (m: string) => {
    ng(m);
    failures++;
  };

  console.log("\n[1] Google Sheets 接続");
  if (!env.GOOGLE_SHEET_ID) fail("GOOGLE_SHEET_ID が未設定");
  else ok(`GOOGLE_SHEET_ID: ${env.GOOGLE_SHEET_ID.slice(0, 6)}…`);
  let saEmail = "";
  try {
    const sa = serviceAccount();
    if (!sa) fail("サービスアカウント（GOOGLE_SERVICE_ACCOUNT_JSON または EMAIL + PRIVATE_KEY）が未設定");
    else {
      saEmail = sa.email;
      if (!sa.key.includes("BEGIN PRIVATE KEY")) fail("秘密鍵の形式が不正です（-----BEGIN PRIVATE KEY----- を含む必要があります）");
      else ok(`サービスアカウント: ${sa.email}`);
    }
  } catch {
    fail("GOOGLE_SERVICE_ACCOUNT_JSON が JSON として読めません（1行で貼り付けてください）");
  }

  let members: Member[] = [];
  const sc = sheetsClient();
  if (sc) {
    try {
      const meta = await sc.api.spreadsheets.get({ spreadsheetId: sc.spreadsheetId });
      ok(`スプレッドシートに接続: 「${meta.data.properties?.title}」`);
      const titles = new Set(meta.data.sheets?.map((s) => s.properties?.title));
      const missing = Object.values(SHEETS).filter((d) => !titles.has(d.sheet));
      if (missing.length) fail(`シートが不足: ${missing.map((d) => d.sheet).join(", ")} → npm run sheets:init を実行`);
      else ok("6シートすべて存在");
      for (const key of Object.keys(SHEETS) as TableKey[]) {
        const def = SHEETS[key];
        if (!titles.has(def.sheet)) continue;
        const res = await sc.api.spreadsheets.values.get({ spreadsheetId: sc.spreadsheetId, range: `'${def.sheet}'!A:Z`, valueRenderOption: "UNFORMATTED_VALUE" });
        const values = (res.data.values ?? []) as unknown[][];
        const header = (values[0] ?? []).map(String);
        const lack = Object.keys(def.columns).filter((c) => !header.includes(c));
        if (lack.length) fail(`${def.sheet}: 列が不足 ${lack.join(", ")} → npm run sheets:init を実行`);
        else console.log(`     ${def.sheet}: ${Math.max(0, values.length - 1)} 行`);
        if (key === "members") members = rowsToObjects(SHEETS.members, values) as Member[];
        if (key === "plans" && values.length <= 1) warn("事業計画が空です → npm run sheets:init -- --master で第5期の計画値を投入できます");
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (/permission|403/i.test(msg)) fail(`スプレッドシートに権限がありません → ${saEmail} を「編集者」で共有してください`);
      else if (/not found|404/i.test(msg)) fail("スプレッドシートが見つかりません → GOOGLE_SHEET_ID を確認してください");
      else if (/has not been used|disabled/i.test(msg)) fail("Google Sheets API が無効です → Cloud Console で有効化してください");
      else fail(`接続エラー: ${msg}`);
    }
  }

  console.log("\n[2] Google ログイン");
  const mode = env.AUTH_MODE;
  if (mode === "dev") warn("AUTH_MODE=dev（視点切替モード）です。本番では削除してください");
  if (!env.GOOGLE_CLIENT_ID) fail("GOOGLE_CLIENT_ID が未設定");
  else if (!env.GOOGLE_CLIENT_ID.endsWith(".apps.googleusercontent.com")) fail("GOOGLE_CLIENT_ID の形式が不正（…apps.googleusercontent.com）");
  else ok("GOOGLE_CLIENT_ID");
  if (!env.GOOGLE_CLIENT_SECRET) fail("GOOGLE_CLIENT_SECRET が未設定");
  else ok("GOOGLE_CLIENT_SECRET");
  if (!env.AUTH_SECRET) fail("AUTH_SECRET が未設定 → npm run secret で生成");
  else if (env.AUTH_SECRET.length < 32) fail(`AUTH_SECRET が短すぎます（${env.AUTH_SECRET.length}文字 / 32文字以上）`);
  else ok("AUTH_SECRET");
  if (!env.APP_URL) warn("APP_URL が未設定（リバースプロキシ配下ではリダイレクトURIがずれることがあります）");
  else if (!/^https:\/\//.test(env.APP_URL) && !/^http:\/\/localhost/.test(env.APP_URL)) fail("APP_URL は https:// で始めてください");
  else {
    ok(`APP_URL: ${env.APP_URL}`);
    console.log(`     → Google Cloud Console の「承認済みのリダイレクトURI」に登録: ${env.APP_URL.replace(/\/$/, "")}/api/auth/callback`);
  }

  console.log("\n[3] メンバー・ADMIN");
  if (sc && members.length) {
    const active = members.filter((m) => m.is_active);
    const admins = active.filter((m) => m.role === "ADMIN" && m.email);
    if (!admins.length) fail("メールアドレス付きの在籍 ADMIN がいません → npm run sheets:init -- --admin-email=you@example.com");
    else ok(`ログイン可能な ADMIN: ${admins.map((a) => `${a.name} <${a.email}>`).join(", ")}`);
    const noEmail = active.filter((m) => !m.email);
    if (noEmail.length) warn(`メール未登録（ログイン不可）: ${noEmail.map((m) => m.name).join(", ")}`);
    const domain = env.AUTH_ALLOWED_DOMAIN?.toLowerCase();
    if (domain) {
      const outside = active.filter((m) => m.email && !m.email.toLowerCase().endsWith(`@${domain}`));
      if (outside.length) warn(`AUTH_ALLOWED_DOMAIN(${domain}) 外のメール（ログイン不可）: ${outside.map((m) => m.email).join(", ")}`);
    }
    const leaders = ["SALES", "HR", "LOGI"].filter((d) => !active.some((m) => m.department === d && m.role === "LEADER"));
    if (leaders.length) warn(`LEADER 不在の事業部（インセン受取人なし）: ${leaders.join(", ")}`);
  } else if (sc) fail("メンバーが0人です → npm run sheets:init -- --admin-email=you@example.com");

  console.log(failures ? `\n❌ ${failures} 件の問題があります` : "\n✅ すべてのチェックに合格しました");
  process.exit(failures ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
