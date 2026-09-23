// スプレッドシートの初期セットアップ（何度実行しても安全。既存データは上書きしない）
//   npm run sheets:init                                  不足しているシート・列を作成
//   npm run sheets:init -- --master                      空の「事業計画」「設定パラメータ」に第5期の値を投入（本番向け）
//   npm run sheets:init -- --admin-email=you@example.com --admin-name=氏名
//                                                        ログインできる最初の ADMIN を登録
//   npm run sheets:init -- --seed                        空のシートにデモデータ（架空の売上明細含む）を投入 ※テスト用シートのみ
import { objectToRow, SHEETS, type TableKey } from "../src/lib/db/schema";
import { createSeedDatabase } from "../src/lib/seed";
import type { Member } from "../src/lib/types";
import { arg, loadEnv, sheetsClient } from "./lib";

async function main() {
  loadEnv();
  const sc = sheetsClient();
  if (!sc) throw new Error("GOOGLE_SHEET_ID とサービスアカウント認証情報を .env.local に設定してください（npm run setup:check で確認できます）");
  const { api, spreadsheetId } = sc;
  const seedAll = arg("seed") === "true";
  const seedMaster = arg("master") === "true";
  const adminEmail = arg("admin-email");
  const seed = createSeedDatabase();

  const meta = await api.spreadsheets.get({ spreadsheetId });
  console.log(`対象: ${meta.data.properties?.title}`);
  const existing = new Set(meta.data.sheets?.map((s) => s.properties?.title));
  const missing = Object.values(SHEETS).filter((d) => !existing.has(d.sheet));
  if (missing.length) {
    await api.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests: missing.map((d) => ({ addSheet: { properties: { title: d.sheet, gridProperties: { frozenRowCount: 1 } } } })) },
    });
    console.log("シート作成:", missing.map((d) => d.sheet).join(", "));
  }

  const headers: Partial<Record<TableKey, string[]>> = {};
  const counts: Partial<Record<TableKey, number>> = {};
  for (const key of Object.keys(SHEETS) as TableKey[]) {
    const def = SHEETS[key];
    const res = await api.spreadsheets.values.get({ spreadsheetId, range: `'${def.sheet}'!A:Z` });
    const values = res.data.values ?? [];
    let header = (values[0] ?? []).map(String);
    const need = Object.keys(def.columns).filter((c) => !header.includes(c));
    if (need.length) {
      header = [...header, ...need];
      await api.spreadsheets.values.update({ spreadsheetId, range: `'${def.sheet}'!A1`, valueInputOption: "RAW", requestBody: { values: [header] } });
      console.log(`${def.sheet}: 列を追加 ${need.join(", ")}`);
    }
    headers[key] = header;
    counts[key] = Math.max(0, values.length - 1);
  }

  const append = async (key: TableKey, rows: unknown[]) => {
    if (!rows.length) return;
    await api.spreadsheets.values.append({
      spreadsheetId,
      range: `'${SHEETS[key].sheet}'!A1`,
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: rows.map((r) => objectToRow(SHEETS[key], headers[key]!, r as never)) },
    });
    counts[key] = (counts[key] ?? 0) + rows.length;
    console.log(`${SHEETS[key].sheet}: ${rows.length} 行を投入`);
  };

  const targets: TableKey[] = seedAll ? (Object.keys(SHEETS) as TableKey[]) : seedMaster ? ["plans", "params"] : [];
  for (const key of targets) {
    if (counts[key]) console.log(`${SHEETS[key].sheet}: 既にデータがあるためスキップ`);
    else await append(key, seed[key] as unknown[]);
  }

  if (adminEmail && adminEmail !== "true") {
    const res = await api.spreadsheets.values.get({ spreadsheetId, range: `'${SHEETS.members.sheet}'!A:Z` });
    const [h = [], ...rows] = (res.data.values ?? []) as string[][];
    const col = (name: string) => h.indexOf(name);
    const exists = rows.some((r) => String(r[col("email")] ?? "").trim().toLowerCase() === adminEmail.trim().toLowerCase());
    if (exists) console.log(`ADMIN: ${adminEmail} は既に登録されています`);
    else {
      const ids = rows.map((r) => Number(String(r[col("member_id")] ?? "").replace(/\D/g, "")) || 0);
      const member: Member = {
        member_id: `MEM_${String(Math.max(-1, ...ids) + 1).padStart(3, "0")}`,
        name: arg("admin-name") ?? adminEmail.split("@")[0],
        department: "HQ",
        role: "ADMIN",
        base_salary: 0,
        is_active: true,
        email: adminEmail.trim(),
      };
      await append("members", [member]);
      console.log(`ADMIN を登録しました: ${member.member_id} ${member.name} <${member.email}>（基本給は画面から設定してください）`);
    }
  }
  console.log("完了。npm run setup:check で全体の設定を確認できます。");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
