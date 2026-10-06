import { describe, expect, it } from "vitest";
import { csvToRecords, parseCsv, toCsv } from "../csv";
import { parseNumber, prepareImport } from "../db/import";
import { createSeedDatabase } from "../seed";
import type { SalesTransaction } from "../types";

describe("csv", () => {
  it("parses quotes, commas, newlines, BOM and CRLF", () => {
    const text = '﻿a,b,c\r\n1,"x, y","say ""hi""\nnext"\r\n\r\n';
    expect(parseCsv(text)).toEqual([
      ["a", "b", "c"],
      ["1", "x, y", 'say "hi"\nnext'],
    ]);
  });
  it("round-trips through toCsv", () => {
    const rows = [["a", "b"], ["1,2", 'q"q']];
    expect(parseCsv(toCsv(rows))).toEqual(rows);
  });
});

describe("parseNumber", () => {
  it("handles yen, commas and percent", () => {
    expect(parseNumber("¥1,234,000")).toBe(1234000);
    expect(parseNumber("50%")).toBe(0.5);
    expect(parseNumber("")).toBeUndefined();
    expect(parseNumber("abc")).toBeNaN();
  });
});

describe("prepareImport", () => {
  it("imports transactions with defaults and sequential ids", () => {
    const db = createSeedDatabase();
    const recs = csvToRecords("date,department,member_id,category,title,gross_sales\n2026/9/1,HR,MEM_004,CA入社決定,テスト社,\"¥500,000\"\n");
    const r = prepareImport("transactions", recs, db, "2026-09-01T00:00:00Z");
    expect(r.errors).toEqual([]);
    const tx = r.rows[0] as SalesTransaction;
    expect(tx.tx_id).toBe("TX_0018");
    expect(tx.date).toBe("2026-09-01");
    expect(tx.year_month).toBe("2026-09");
    expect(tx.gross_sales).toBe(500000);
    expect(tx.status).toBe("APPROVED");
    expect(tx.lead_source).toBe("DIRECT");
  });

  it("reports row-numbered errors", () => {
    const db = createSeedDatabase();
    const recs = csvToRecords("date,department,member_id,category,title,gross_sales\n2026-13,XX,MEM_999,,,abc\n");
    const r = prepareImport("transactions", recs, db);
    expect(r.errors.length).toBeGreaterThanOrEqual(5);
    expect(r.errors[0]).toMatch(/^2行目/);
  });

  it("rejects impossible dates", () => {
    const db = createSeedDatabase();
    for (const d of ["2026-13-01", "2026-02-30"]) {
      const r = prepareImport("transactions", csvToRecords(`date,department,member_id,category,title,gross_sales\n${d},HR,MEM_004,x,y,1\n`), db);
      expect(r.errors.some((e) => e.includes("date"))).toBe(true);
    }
  });

  it("referral split accepts percent", () => {
    const db = createSeedDatabase();
    const recs = csvToRecords("year_month,from_member_id,to_dept,client_name,gross_amount,split_rate\n2026-09,MEM_001,HR,A氏,800000,50%\n");
    const r = prepareImport("referrals", recs, db);
    expect(r.errors).toEqual([]);
    expect((r.rows[0] as { split_rate: number }).split_rate).toBe(0.5);
  });

  it("plans are upserted by month and department", () => {
    const r = prepareImport("plans", csvToRecords("year_month,department,target_sales,target_op\n2026-8,SALES,100,50\n"), createSeedDatabase());
    expect(r.mode).toBe("upsert");
    expect(r.rows[0]).toMatchObject({ plan_id: "2026-08_SALES", target_sales: 100 });
  });
});

describe("Japanese sheet headers and values", () => {
  it("reads Japanese headers/enum labels and writes them back in Japanese", async () => {
    const { SHEETS, rowsToObjects, objectToRow, headerLabels } = await import("../db/schema");
    const header = headerLabels(SHEETS.members);
    expect(header).toEqual(["メンバーID", "氏名", "所属", "権限", "基本給", "在籍", "メールアドレス"]);
    const rows = rowsToObjects(SHEETS.members, [header, ["MEM_001", "勇志", "イベント営業", "統括", "320,000", true, "y@example.com"]]);
    expect(rows[0]).toMatchObject({ department: "SALES", role: "LEADER", base_salary: 320000, is_active: true });
    expect(objectToRow(SHEETS.members, header, rows[0])).toEqual(["MEM_001", "勇志", "イベント営業", "統括", 320000, true, "y@example.com"]);
  });

  it("still reads legacy English headers and codes", async () => {
    const { SHEETS, rowsToObjects } = await import("../db/schema");
    const rows = rowsToObjects(SHEETS.transactions, [
      ["tx_id", "date", "department", "status", "gross_sales"],
      ["TX_0001", "2026-08-01", "HR", "PENDING", 1],
    ]);
    expect(rows[0]).toMatchObject({ department: "HR", status: "PENDING" });
  });

  it("imports the Japanese CSV templates", async () => {
    const { readFileSync } = await import("fs");
    const { SHEETS, normalizeRecord } = await import("../db/schema");
    const db = createSeedDatabase();
    for (const t of ["transactions", "expenses", "referrals", "plans", "members", "params"] as const) {
      const recs = csvToRecords(readFileSync(`templates/${t}.csv`, "utf8")).map((r) => normalizeRecord(SHEETS[t], r));
      const res = prepareImport(t, recs, db);
      expect(res.errors, t).toEqual([]);
    }
  });
});
