// CSV の一括取り込み
//   npm run import -- <テーブル> <CSVファイル>            確認のみ（書き込まない）
//   npm run import -- <テーブル> <CSVファイル> --apply    書き込む
// テーブル: transactions / expenses / referrals / plans / members / params
// 雛形: templates/*.csv（1行目の列名をそのまま使う）
import { promises as fs } from "fs";
import { csvToRecords } from "../src/lib/csv";
import { prepareImport } from "../src/lib/db/import";
import { SHEETS, type TableKey } from "../src/lib/db/schema";
import { arg, loadEnv, positional, store } from "./lib";

async function main() {
  loadEnv();
  const [table, file] = positional();
  const tables = Object.keys(SHEETS) as TableKey[];
  if (!tables.includes(table as TableKey) || !file) {
    console.log(`使い方: npm run import -- <${tables.join("|")}> <file.csv> [--apply]`);
    process.exit(1);
  }
  const s = store();
  const db = await s.load();
  const records = csvToRecords(await fs.readFile(file, "utf8"));
  const res = prepareImport(table as TableKey, records, db);

  console.log(`${SHEETS[table as TableKey].sheet} へ ${records.length} 行（${res.mode === "append" ? "追加" : "主キーで上書き/追加"}）・保存先: ${s.kind}`);
  if (res.errors.length) {
    console.log(`\nエラー ${res.errors.length} 件（書き込みは行いません）:`);
    for (const e of res.errors.slice(0, 50)) console.log(`  - ${e}`);
    process.exit(1);
  }
  console.table((res.rows as Record<string, unknown>[]).slice(0, 10));
  if (res.rows.length > 10) console.log(`…ほか ${res.rows.length - 10} 行`);
  if (!arg("apply")) {
    console.log("\n問題ありません。書き込むには --apply を付けて再実行してください。");
    return;
  }
  await s.write(table as TableKey, res.rows as never[], res.mode);
  console.log(`\n✅ ${res.rows.length} 行を書き込みました`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
