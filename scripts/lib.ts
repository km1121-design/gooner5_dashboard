// CLI スクリプト共通処理（Next.js の server-only モジュールは読み込めないため別実装）
import { existsSync, promises as fs } from "fs";
import path from "path";
import { google, type sheets_v4 } from "googleapis";
import { objectToRow, rowsToObjects, SHEETS, type Row, type TableKey } from "../src/lib/db/schema";
import { createSeedDatabase } from "../src/lib/seed";
import type { Database } from "../src/lib/types";

export function loadEnv() {
  for (const f of [".env.local", ".env"]) if (existsSync(f)) process.loadEnvFile?.(f);
}

export function arg(name: string): string | undefined {
  const hit = process.argv.find((a) => a === `--${name}` || a.startsWith(`--${name}=`));
  if (!hit) return undefined;
  return hit.includes("=") ? hit.slice(hit.indexOf("=") + 1) : "true";
}

export const positional = () => process.argv.slice(2).filter((a) => !a.startsWith("--"));

export function serviceAccount(): { email: string; key: string } | null {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (raw) {
    const j = JSON.parse(raw) as { client_email?: string; private_key?: string };
    if (j.client_email && j.private_key) return { email: j.client_email, key: j.private_key };
    return null;
  }
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  return email && key ? { email, key } : null;
}

export function sheetsClient(): { api: sheets_v4.Sheets; spreadsheetId: string } | null {
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;
  const sa = serviceAccount();
  if (!spreadsheetId || !sa) return null;
  const auth = new google.auth.JWT({ email: sa.email, key: sa.key, scopes: ["https://www.googleapis.com/auth/spreadsheets"] });
  return { api: google.sheets({ version: "v4", auth }), spreadsheetId };
}

const q = (s: string) => `'${s.replace(/'/g, "''")}'`;
const LOCAL_DB = path.join(process.cwd(), ".data", "db.json");

/** Sheets（設定済みの場合）またはローカル JSON の読み書き */
export function store() {
  const sc = sheetsClient();
  if (sc) {
    const { api, spreadsheetId } = sc;
    const read = async (t: TableKey) => {
      const res = await api.spreadsheets.values.get({ spreadsheetId, range: `${q(SHEETS[t].sheet)}!A:Z`, valueRenderOption: "UNFORMATTED_VALUE" });
      return (res.data.values ?? []) as unknown[][];
    };
    return {
      kind: "sheets" as const,
      async load(): Promise<Database> {
        const db = {} as Record<string, unknown>;
        for (const t of Object.keys(SHEETS) as TableKey[]) db[t] = rowsToObjects(SHEETS[t], await read(t));
        return db as unknown as Database;
      },
      async write<K extends TableKey>(t: K, rows: Row<K>[], mode: "append" | "upsert") {
        const def = SHEETS[t];
        const values = await read(t);
        const header = (values[0] ?? []).map(String);
        if (!header.length) throw new Error(`${def.sheet} にヘッダー行がありません。先に npm run sheets:init を実行してください`);
        const idIdx = header.indexOf(def.idColumn);
        const at = new Map<string, number>();
        values.slice(1).forEach((r, i) => at.set(String(r[idIdx]), i + 2));
        const updates: sheets_v4.Schema$ValueRange[] = [];
        const appends: (string | number | boolean)[][] = [];
        for (const row of rows) {
          const line = objectToRow(def, header, row);
          const id = String((row as unknown as Record<string, unknown>)[def.idColumn]);
          const n = mode === "upsert" ? at.get(id) : undefined;
          if (n) updates.push({ range: `${q(def.sheet)}!A${n}`, values: [line] });
          else appends.push(line);
        }
        if (updates.length) await api.spreadsheets.values.batchUpdate({ spreadsheetId, requestBody: { valueInputOption: "RAW", data: updates } });
        if (appends.length)
          await api.spreadsheets.values.append({ spreadsheetId, range: `${q(def.sheet)}!A1`, valueInputOption: "RAW", insertDataOption: "INSERT_ROWS", requestBody: { values: appends } });
      },
    };
  }
  let cache: Database | null = null;
  return {
    kind: "local" as const,
    async load(): Promise<Database> {
      if (cache) return cache;
      cache = existsSync(LOCAL_DB) ? { ...createSeedDatabase(), ...JSON.parse(await fs.readFile(LOCAL_DB, "utf8")) } : createSeedDatabase();
      return cache!;
    },
    async write<K extends TableKey>(t: K, rows: Row<K>[], mode: "append" | "upsert") {
      const db = await this.load();
      const list = db[t] as Row<K>[];
      const idCol = SHEETS[t].idColumn;
      const idOf = (r: Row<K>) => String((r as unknown as Record<string, unknown>)[idCol]);
      for (const row of rows) {
        const i = mode === "upsert" ? list.findIndex((r) => idOf(r) === idOf(row)) : -1;
        if (i >= 0) list[i] = row;
        else list.push(row);
      }
      await fs.mkdir(path.dirname(LOCAL_DB), { recursive: true });
      await fs.writeFile(LOCAL_DB, JSON.stringify(db, null, 2));
    },
  };
}

export const ok = (m: string) => console.log(`  ✅ ${m}`);
export const ng = (m: string) => console.log(`  ❌ ${m}`);
export const warn = (m: string) => console.log(`  ⚠️  ${m}`);
