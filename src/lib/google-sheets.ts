import "server-only";
import { google, type sheets_v4 } from "googleapis";

// Google Sheets API v4 クライアント（サービスアカウント認証）。
// 必要な環境変数:
//   GOOGLE_SHEET_ID                    対象スプレッドシートID
//   GOOGLE_SERVICE_ACCOUNT_EMAIL       サービスアカウントのメールアドレス
//   GOOGLE_PRIVATE_KEY                 秘密鍵（"\n" エスケープ可）
// もしくは GOOGLE_SERVICE_ACCOUNT_JSON にキーJSONをそのまま設定しても良い。

let client: sheets_v4.Sheets | null = null;

function credentials(): { email: string; key: string } | null {
  const json = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (json) {
    const parsed = JSON.parse(json) as { client_email: string; private_key: string };
    return { email: parsed.client_email, key: parsed.private_key };
  }
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  return email && key ? { email, key } : null;
}

export function isSheetsConfigured(): boolean {
  return Boolean(process.env.GOOGLE_SHEET_ID && credentials());
}

export function getSheetId(): string {
  const id = process.env.GOOGLE_SHEET_ID;
  if (!id) throw new Error("GOOGLE_SHEET_ID is not set");
  return id;
}

export function getSheetsClient(): sheets_v4.Sheets {
  if (client) return client;
  const cred = credentials();
  if (!cred) throw new Error("Google service account credentials are not set");
  const auth = new google.auth.JWT({
    email: cred.email,
    key: cred.key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  client = google.sheets({ version: "v4", auth });
  return client;
}

/** 0-based 列番号 → A1記法の列名 */
export function columnLetter(index: number): string {
  let s = "";
  let n = index + 1;
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

/** シート名をA1記法で安全に参照できるようクォートする */
export function quoteSheet(name: string): string {
  return `'${name.replace(/'/g, "''")}'`;
}
