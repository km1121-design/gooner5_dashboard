// 全シートを JSON に書き出す: npm run backup  → backups/gooner5-YYYYMMDD-HHmm.json
import { promises as fs } from "fs";
import path from "path";
import { loadEnv, store } from "./lib";

async function main() {
  loadEnv();
  const s = store();
  const db = await s.load();
  const stamp = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Tokyo", dateStyle: "short", timeStyle: "short" }).format(new Date()).replace(/[-: ]/g, "");
  const dir = path.join(process.cwd(), "backups");
  await fs.mkdir(dir, { recursive: true });
  const file = path.join(dir, `gooner5-${stamp.slice(0, 8)}-${stamp.slice(8)}.json`);
  await fs.writeFile(file, JSON.stringify({ source: s.kind, exported_at: new Date().toISOString(), data: db }, null, 2));
  const counts = Object.entries(db).map(([k, v]) => `${k}=${(v as unknown[]).length}`).join(" ");
  console.log(`バックアップを保存しました（${s.kind}）: ${file}\n  ${counts}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
