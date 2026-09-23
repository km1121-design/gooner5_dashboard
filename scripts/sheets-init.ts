// スプレッドシートの初期セットアップ。
//   npm run sheets:init           不足しているシート・ヘッダーを作成（既存データは変更しない）
//   npm run sheets:init -- --seed 空のシートにサンプルデータを投入
// .env.local の GOOGLE_SHEET_ID / GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_PRIVATE_KEY を使用する。
import { google } from "googleapis";
import { objectToRow, SHEETS, type TableKey } from "../src/lib/db/schema";
import { createSeedDatabase } from "../src/lib/seed";

async function main() {
  process.loadEnvFile?.(".env.local");
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;
  const json = process.env.GOOGLE_SERVICE_ACCOUNT_JSON ? JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON) : null;
  const email = json?.client_email ?? process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = (json?.private_key ?? process.env.GOOGLE_PRIVATE_KEY)?.replace(/\\n/g, "\n");
  if (!spreadsheetId || !email || !key) throw new Error("GOOGLE_SHEET_ID と サービスアカウント認証情報を .env.local に設定してください");

  const auth = new google.auth.JWT({ email, key, scopes: ["https://www.googleapis.com/auth/spreadsheets"] });
  const sheets = google.sheets({ version: "v4", auth });
  const seed = process.argv.includes("--seed") ? createSeedDatabase() : null;

  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const existing = new Set(meta.data.sheets?.map((s) => s.properties?.title));
  const missing = Object.values(SHEETS).filter((d) => !existing.has(d.sheet));
  if (missing.length) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests: missing.map((d) => ({ addSheet: { properties: { title: d.sheet, gridProperties: { frozenRowCount: 1 } } } })) },
    });
    console.log("作成:", missing.map((d) => d.sheet).join(", "));
  }

  for (const key of Object.keys(SHEETS) as TableKey[]) {
    const def = SHEETS[key];
    const range = `'${def.sheet}'!A:Z`;
    const res = await sheets.spreadsheets.values.get({ spreadsheetId, range });
    const values = res.data.values ?? [];
    let header = (values[0] ?? []).map(String);
    const need = Object.keys(def.columns).filter((c) => !header.includes(c));
    if (need.length) {
      header = [...header, ...need];
      await sheets.spreadsheets.values.update({ spreadsheetId, range: `'${def.sheet}'!A1`, valueInputOption: "RAW", requestBody: { values: [header] } });
      console.log(`${def.sheet}: 列を追加 ${need.join(", ")}`);
    }
    if (seed && values.length <= 1) {
      const rows = (seed[key] as unknown[]).map((r) => objectToRow(def, header, r as never));
      if (rows.length) {
        await sheets.spreadsheets.values.append({ spreadsheetId, range: `'${def.sheet}'!A1`, valueInputOption: "RAW", insertDataOption: "INSERT_ROWS", requestBody: { values: rows } });
        console.log(`${def.sheet}: サンプル ${rows.length} 行を投入`);
      }
    }
  }
  console.log("完了");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
