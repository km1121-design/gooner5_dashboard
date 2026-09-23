import "server-only";
import { promises as fs } from "fs";
import path from "path";
import { columnLetter, getSheetId, getSheetsClient, isSheetsConfigured, quoteSheet } from "../google-sheets";
import { createSeedDatabase } from "../seed";
import type { Database } from "../types";
import { objectToRow, rowsToObjects, SHEETS, type Row, type TableKey } from "./schema";

// データアクセス層。GOOGLE_SHEET_ID 等が設定されていれば Google Sheets、
// 未設定ならローカルJSON（.data/db.json、初回はサンプルデータ）を使う。

export interface Repository {
  kind: "sheets" | "local";
  load(): Promise<Database>;
  insert<K extends TableKey>(table: K, row: Row<K>): Promise<void>;
  /** 主キー一致の行を置き換え、無ければ追加 */
  upsert<K extends TableKey>(table: K, rows: Row<K>[]): Promise<void>;
}

function idOf<K extends TableKey>(table: K, row: Row<K>): string {
  return String((row as unknown as Record<string, unknown>)[SHEETS[table].idColumn]);
}

// ------------------------------------------------------------------ Google Sheets

const CACHE_TTL_MS = 15_000;

class SheetsRepository implements Repository {
  kind = "sheets" as const;
  private cache: { at: number; db: Database } | null = null;

  async load(): Promise<Database> {
    if (this.cache && Date.now() - this.cache.at < CACHE_TTL_MS) return this.cache.db;
    const keys = Object.keys(SHEETS) as TableKey[];
    const res = await getSheetsClient().spreadsheets.values.batchGet({
      spreadsheetId: getSheetId(),
      ranges: keys.map((k) => `${quoteSheet(SHEETS[k].sheet)}!A:Z`),
      valueRenderOption: "UNFORMATTED_VALUE",
    });
    const db = {} as Database;
    keys.forEach((k, i) => {
      const values = (res.data.valueRanges?.[i]?.values ?? []) as unknown[][];
      (db as unknown as Record<string, unknown>)[k] = rowsToObjects(SHEETS[k], values);
    });
    this.cache = { at: Date.now(), db };
    return db;
  }

  private async readSheet(table: TableKey) {
    const res = await getSheetsClient().spreadsheets.values.get({
      spreadsheetId: getSheetId(),
      range: `${quoteSheet(SHEETS[table].sheet)}!A:Z`,
      valueRenderOption: "UNFORMATTED_VALUE",
    });
    const values = (res.data.values ?? []) as unknown[][];
    const header = (values[0] ?? []).map((h) => String(h).trim());
    return { values, header };
  }

  async insert<K extends TableKey>(table: K, row: Row<K>) {
    const { header } = await this.readSheet(table);
    await getSheetsClient().spreadsheets.values.append({
      spreadsheetId: getSheetId(),
      range: `${quoteSheet(SHEETS[table].sheet)}!A1`,
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: [objectToRow(SHEETS[table], header, row)] },
    });
    this.cache = null;
  }

  async upsert<K extends TableKey>(table: K, rows: Row<K>[]) {
    const def = SHEETS[table];
    const { values, header } = await this.readSheet(table);
    const idIdx = header.indexOf(def.idColumn);
    if (idIdx < 0) throw new Error(`${def.sheet} に ${def.idColumn} 列がありません`);
    const rowIndex = new Map<string, number>();
    values.slice(1).forEach((r, i) => rowIndex.set(String(r[idIdx]), i + 2));
    const lastCol = columnLetter(header.length - 1);

    const updates: { range: string; values: (string | number | boolean)[][] }[] = [];
    const appends: (string | number | boolean)[][] = [];
    for (const row of rows) {
      const line = objectToRow(def, header, row);
      const at = rowIndex.get(idOf(table, row));
      if (at) updates.push({ range: `${quoteSheet(def.sheet)}!A${at}:${lastCol}${at}`, values: [line] });
      else appends.push(line);
    }
    const api = getSheetsClient().spreadsheets.values;
    if (updates.length) {
      await api.batchUpdate({ spreadsheetId: getSheetId(), requestBody: { valueInputOption: "RAW", data: updates } });
    }
    if (appends.length) {
      await api.append({
        spreadsheetId: getSheetId(),
        range: `${quoteSheet(def.sheet)}!A1`,
        valueInputOption: "RAW",
        insertDataOption: "INSERT_ROWS",
        requestBody: { values: appends },
      });
    }
    this.cache = null;
  }
}

// ------------------------------------------------------------------ Local JSON（開発用）

class LocalRepository implements Repository {
  kind = "local" as const;
  private file = path.join(process.cwd(), ".data", "db.json");
  private db: Database | null = null;
  private queue: Promise<void> = Promise.resolve();

  async load(): Promise<Database> {
    if (this.db) return this.db;
    try {
      const loaded = JSON.parse(await fs.readFile(this.file, "utf8")) as Database;
      this.db = { ...createSeedDatabase(), ...loaded };
    } catch {
      this.db = createSeedDatabase();
    }
    return this.db;
  }

  private persist() {
    this.queue = this.queue.then(async () => {
      await fs.mkdir(path.dirname(this.file), { recursive: true });
      await fs.writeFile(this.file, JSON.stringify(this.db, null, 2));
    });
    return this.queue;
  }

  async insert<K extends TableKey>(table: K, row: Row<K>) {
    const db = await this.load();
    (db[table] as Row<K>[]).push(row);
    await this.persist();
  }

  async upsert<K extends TableKey>(table: K, rows: Row<K>[]) {
    const db = await this.load();
    const list = db[table] as Row<K>[];
    for (const row of rows) {
      const i = list.findIndex((r) => idOf(table, r) === idOf(table, row));
      if (i >= 0) list[i] = row;
      else list.push(row);
    }
    await this.persist();
  }
}

// Next.js の開発サーバーはモジュールを再評価することがあるため globalThis に保持する
const g = globalThis as unknown as { __goonerRepo?: Repository };

export function getRepository(): Repository {
  if (!g.__goonerRepo) g.__goonerRepo = isSheetsConfigured() ? new SheetsRepository() : new LocalRepository();
  return g.__goonerRepo;
}

/** PREFIX_0001 形式の連番IDを採番 */
export function nextId(existing: string[], prefix: string): string {
  let max = 0;
  for (const id of existing) {
    const m = id.match(new RegExp(`^${prefix}_(\\d+)$`));
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `${prefix}_${String(max + 1).padStart(4, "0")}`;
}
