import type { BusinessDept, Dept } from "./types";

export type Half = "H1" | "H2";

export interface TermMonth {
  key: string; // YYYY-MM
  label: string;
  short: string;
  half: Half;
}

/** 第5期: 2026-08 〜 2027-07。上期(H1)=8〜1月、下期(H2)=2〜7月 */
export const TERM_START = "2026-08";
export const TERM_MONTHS: TermMonth[] = Array.from({ length: 12 }, (_, i) => {
  const d = new Date(Date.UTC(2026, 7 + i, 1));
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + 1;
  return {
    key: `${y}-${String(m).padStart(2, "0")}`,
    label: `${y}年${m}月度`,
    short: `${m}月`,
    half: i < 6 ? "H1" : "H2",
  };
});

export const HALF_MONTHS: Record<Half, string[]> = {
  H1: TERM_MONTHS.filter((m) => m.half === "H1").map((m) => m.key),
  H2: TERM_MONTHS.filter((m) => m.half === "H2").map((m) => m.key),
};

export const HALF_LABEL: Record<Half, string> = {
  H1: "上期 (8月〜1月)",
  H2: "下期 (2月〜7月)",
};

export const BUSINESS_DEPTS: BusinessDept[] = ["SALES", "HR", "LOGI"];
export const ALL_DEPTS: Dept[] = ["SALES", "HR", "LOGI", "HQ"];

export const DEPT_META: Record<Dept, { label: string; short: string; color: string; desc: string }> = {
  SALES: { label: "イベント営業事業部", short: "イベント営業", color: "#eb6834", desc: "BAR店舗 / リファーラル営業" },
  HR: { label: "人材事業部", short: "人材", color: "#2a78d6", desc: "中途職業紹介" },
  LOGI: { label: "運送事業部", short: "運送", color: "#1baf7a", desc: "大和稼働 / 企業配" },
  HQ: { label: "本部", short: "本部", color: "#8a8983", desc: "管理部門" },
};

/** 実績報告フォームで選択できる区分 */
export const CATEGORY_OPTIONS: Record<BusinessDept, string[]> = {
  SALES: ["BAR売上", "イベント運営", "協賛", "その他"],
  HR: ["CA入社決定", "RA売上", "その他"],
  LOGI: ["大和稼働", "企業配", "スポット", "その他"],
};

export const EXPENSE_CATEGORIES = ["広告費", "人件費", "外注費", "予備車経費", "雑費", "交際費", "コンサル費", "その他"];

/** 03_M_設定パラメータ の既定値（シートに無いキーはこの値で補完） */
export const DEFAULT_PARAMS: { key: string; value: number; description: string }[] = [
  { key: "fixed_cost_sales", value: 430000, description: "イベント営業 月次固定費（人件費等）" },
  { key: "fixed_cost_hr", value: 2900000, description: "人材 月次固定費（人件費等）" },
  { key: "fixed_cost_logi", value: 750000, description: "運送 月次固定費（予備車・配賦等）" },
  { key: "fixed_cost_hq", value: 0, description: "本部 月次固定費" },
  { key: "sales_bar_inc_threshold", value: 1000000, description: "BARインセン発動の単月事業部営業利益閾値" },
  { key: "sales_bar_inc_rate", value: 0.1, description: "BARインセン率（BAR売上に対して）" },
  { key: "sales_half_base_rate", value: 0.1, description: "営業 半期ボーナス基本率（事業部営業利益に対して）" },
  { key: "sales_half_excess_rate", value: 0.2, description: "営業 半期目標超過分ボーナス率" },
  { key: "sales_half_target_h1", value: 8120000, description: "営業 上期営業利益目標（0なら事業計画の合計）" },
  { key: "sales_half_target_h2", value: 0, description: "営業 下期営業利益目標（0なら事業計画の合計）" },
  { key: "ref_split_hr_default", value: 0.5, description: "転職支援リファーラル 紹介元配分率（既定）" },
  { key: "ref_split_moving_default", value: 0.8, description: "引越しリファーラル 紹介元配分率（既定）" },
  { key: "hr_masterkey_rate", value: 0.2, description: "人材 マスターキー手数料率" },
  { key: "hr_placement_ad_fee", value: 10000, description: "入社決定手当（広告・自社経由）" },
  { key: "hr_placement_ref_fee", value: 30000, description: "入社決定手当（リファーラル経由）" },
  { key: "hr_dept_bonus_rate", value: 0.03, description: "人材統括 事業部ボーナス率（目標まで）" },
  { key: "hr_dept_bonus_excess_rate", value: 0.05, description: "人材統括 事業部ボーナス率（目標超過分）" },
  { key: "hr_half_target_h1", value: 10425000, description: "人材 上期営業利益目標（0なら事業計画の合計）" },
  { key: "hr_half_target_h2", value: 0, description: "人材 下期営業利益目標（0なら事業計画の合計）" },
  { key: "hr_personal_bonus_rate", value: 0.15, description: "人材 個人PLボーナス率（個人営業利益に対して）" },
  { key: "hr_personal_fixed_cost", value: 200000, description: "人材 個人PLの月次固定費配賦額" },
  { key: "logi_inc_rate", value: 0.15, description: "運送統括 インセン率（大和利益に対して）" },
  { key: "logi_inc_monthly_rate", value: 0.1, description: "うち翌々月15日支給分" },
  { key: "company_annual_op_target", value: 50000000, description: "全社 年間営業利益目標（下限）" },
  { key: "company_annual_op_stretch", value: 60000000, description: "全社 年間営業利益目標（ストレッチ）" },
];
