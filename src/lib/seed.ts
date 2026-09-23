import { DEFAULT_PARAMS } from "./constants";
import type { BusinessDept, Database, MonthlyPlan, SalesTransaction } from "./types";

// プロトタイプ（gooner_dashboard.html）のサンプルデータを新スキーマに移植したもの。
// Google Sheets 未接続時のローカル開発用、および `npm run sheets:init` の初期投入に使う。

const PLAN_TABLE: Record<string, Record<BusinessDept, [number, number]>> = {
  "2026-08": { SALES: [1652620, 1222620], HR: [6000000, 1900000], LOGI: [5600000, 550000] },
  "2026-09": { SALES: [2031420, 1511420], HR: [6000000, 1900000], LOGI: [5600000, 550000] },
  "2026-10": { SALES: [1821720, 1001720], HR: [6000000, 1900000], LOGI: [5800000, 600000] },
  "2026-11": { SALES: [1939220, 1019220], HR: [6000000, 1175000], LOGI: [5800000, 600000] },
  "2026-12": { SALES: [3137930, 2117930], HR: [6500000, 1575000], LOGI: [6000000, 650000] },
  "2027-01": { SALES: [2268180, 1348180], HR: [7000000, 1975000], LOGI: [5800000, 600000] },
  "2027-02": { SALES: [2518180, 1248180], HR: [7000000, 1975000], LOGI: [5800000, 600000] },
  "2027-03": { SALES: [2794430, 1474430], HR: [7500000, 2375000], LOGI: [6000000, 650000] },
  "2027-04": { SALES: [3294430, 1974430], HR: [7500000, 2375000], LOGI: [6000000, 650000] },
  "2027-05": { SALES: [3453180, 2133180], HR: [7500000, 2375000], LOGI: [6000000, 650000] },
  "2027-06": { SALES: [4778780, 3458780], HR: [7500000, 2375000], LOGI: [6200000, 700000] },
  "2027-07": { SALES: [4611930, 3291930], HR: [7500000, 2375000], LOGI: [6200000, 700000] },
};

const plans: MonthlyPlan[] = Object.entries(PLAN_TABLE).flatMap(([ym, row]) =>
  (Object.keys(row) as BusinessDept[]).map((dept) => ({
    plan_id: `${ym}_${dept}`,
    year_month: ym,
    department: dept,
    target_sales: row[dept][0],
    target_op: row[dept][1],
  })),
);

type TxSeed = [string, BusinessDept, string, string, string, number, number, SalesTransaction["lead_source"]];
const TX: TxSeed[] = [
  ["2026-08-05", "HR", "MEM_002", "CA入社決定", "株式会社テック（Webエンジニア決定）", 500000, 100000, "AD"],
  ["2026-08-12", "HR", "MEM_004", "CA入社決定", "株式会社メディア（営業職入社）", 500000, 100000, "REFERRAL"],
  ["2026-08-19", "HR", "MEM_002", "CA入社決定", "株式会社コマース（CSマネージャー）", 500000, 100000, "REFERRAL"],
  ["2026-08-26", "HR", "MEM_004", "CA入社決定", "株式会社フィンテック（経理職）", 500000, 100000, "AD"],
  ["2026-08-27", "HR", "MEM_004", "CA入社決定", "転職支援（A氏）※営業部リファーラル", 800000, 0, "REFERRAL"],
  ["2026-08-08", "SALES", "MEM_001", "BAR売上", "BAR店舗 週次前半売上（だいき・たける）", 420000, 20000, "DIRECT"],
  ["2026-08-22", "SALES", "MEM_001", "BAR売上", "BAR店舗 週次後半売上", 450000, 25000, "DIRECT"],
  ["2026-08-29", "SALES", "MEM_001", "協賛", "イベント企画運営協賛", 80000, 10000, "DIRECT"],
  ["2026-08-10", "LOGI", "MEM_003", "大和稼働", "大和事業部 8月上旬稼働分", 2600000, 2050000, "DIRECT"],
  ["2026-08-25", "LOGI", "MEM_003", "大和稼働", "大和事業部 8月下旬稼働分", 2500000, 1950000, "DIRECT"],
  ["2026-08-28", "LOGI", "MEM_003", "企業配", "スポット・企業配追加分", 380000, 280000, "DIRECT"],
  ["2026-09-04", "HR", "MEM_002", "CA入社決定", "クラウドベンチャー（バックエンド）", 600000, 120000, "REFERRAL"],
  ["2026-09-10", "HR", "MEM_004", "CA入社決定", "SaaS企業（インサイドセールス）", 500000, 100000, "AD"],
  ["2026-09-18", "HR", "MEM_002", "CA入社決定", "クリニック（看護職）※営業部リファーラル", 1000000, 0, "REFERRAL"],
  ["2026-09-12", "SALES", "MEM_001", "BAR売上", "BAR店舗 9月上旬売上", 480000, 30000, "DIRECT"],
  ["2026-09-15", "LOGI", "MEM_003", "大和稼働", "大和事業部 9月前半稼働", 2700000, 2100000, "DIRECT"],
];

const transactions: SalesTransaction[] = TX.map(([date, dept, mem, cat, title, sales, cost, lead], i) => ({
  tx_id: `TX_${String(i + 1).padStart(4, "0")}`,
  year_month: date.slice(0, 7),
  date,
  department: dept,
  member_id: mem,
  category: cat,
  title,
  gross_sales: sales,
  direct_cost: cost,
  lead_source: lead,
  notes: "",
  status: "APPROVED",
  created_by: mem,
  created_at: `${date}T09:00:00+09:00`,
  approved_by: "MEM_000",
  approved_at: `${date}T18:00:00+09:00`,
}));

// 承認待ちサンプル（承認フローの動作確認用）
transactions.push({
  tx_id: "TX_0017",
  year_month: "2026-09",
  date: "2026-09-19",
  department: "SALES",
  member_id: "MEM_001",
  category: "BAR売上",
  title: "BAR店舗 9月中旬売上",
  gross_sales: 460000,
  direct_cost: 25000,
  lead_source: "DIRECT",
  notes: "",
  status: "PENDING",
  created_by: "MEM_001",
  created_at: "2026-09-19T23:00:00+09:00",
  approved_by: "",
  approved_at: "",
});

export function createSeedDatabase(): Database {
  return structuredClone({
    members: [
      { member_id: "MEM_000", name: "三田航大", department: "HQ", role: "ADMIN", base_salary: 400000, is_active: true, email: "" },
      { member_id: "MEM_001", name: "勇志", department: "SALES", role: "LEADER", base_salary: 320000, is_active: true, email: "" },
      { member_id: "MEM_002", name: "たかちゃん", department: "HR", role: "LEADER", base_salary: 350000, is_active: true, email: "" },
      { member_id: "MEM_003", name: "誠", department: "LOGI", role: "LEADER", base_salary: 400000, is_active: true, email: "" },
      { member_id: "MEM_004", name: "リサ", department: "HR", role: "MEMBER", base_salary: 250000, is_active: true, email: "" },
    ],
    plans,
    params: DEFAULT_PARAMS.map((p) => ({ config_key: p.key, config_value: p.value, description: p.description })),
    transactions,
    expenses: [
      { exp_id: "EXP_0001", year_month: "2026-08", department: "HR", category: "広告費", amount: 150000, description: "求人媒体" },
      { exp_id: "EXP_0002", year_month: "2026-08", department: "SALES", category: "交際費", amount: 30000, description: "BAR関係者会食" },
      { exp_id: "EXP_0003", year_month: "2026-09", department: "HR", category: "広告費", amount: 150000, description: "求人媒体" },
    ],
    referrals: [
      { ref_id: "REF_0001", year_month: "2026-08", from_member_id: "MEM_001", to_dept: "EXTERNAL", client_name: "引越し仲介送客", gross_amount: 400000, split_rate: 0.8, status: "APPROVED" },
      { ref_id: "REF_0002", year_month: "2026-08", from_member_id: "MEM_001", to_dept: "HR", client_name: "転職支援（A氏）", gross_amount: 800000, split_rate: 0.5, status: "APPROVED" },
      { ref_id: "REF_0003", year_month: "2026-09", from_member_id: "MEM_001", to_dept: "HR", client_name: "クリニック送客・転職", gross_amount: 1000000, split_rate: 0.5, status: "APPROVED" },
    ],
  } satisfies Database);
}
