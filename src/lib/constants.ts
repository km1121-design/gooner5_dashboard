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

// ---------------------------------------------------------------- 設定パラメータ

/**
 * 03_M_設定パラメータ の定義と既定値。
 * 金額・料率・支給タイミングはすべてここに集約し、マスター設定画面（またはスプレッドシート）から変更できる。
 * シートに行が無いキーはこの既定値で計算される。新しい数値を追加する場合もここに1行足すだけでよい。
 */
export type ParamUnit = "yen" | "rate" | "months" | "day";
export type ParamGroup = "固定費" | "イベント営業" | "人材" | "運送" | "リファーラル" | "全社目標";

export interface ParamDef {
  key: string;
  value: number;
  description: string;
  group: ParamGroup;
  unit: ParamUnit;
}

export const PARAM_GROUPS: ParamGroup[] = ["固定費", "イベント営業", "人材", "運送", "リファーラル", "全社目標"];

export const DEFAULT_PARAMS: ParamDef[] = [
  // 固定費（月次）
  { group: "固定費", unit: "yen", key: "fixed_cost_sales", value: 430000, description: "イベント営業 月次固定費（人件費等）" },
  { group: "固定費", unit: "yen", key: "fixed_cost_hr", value: 2900000, description: "人材 月次固定費（人件費等）" },
  { group: "固定費", unit: "yen", key: "fixed_cost_logi", value: 750000, description: "運送 月次固定費（予備車・配賦等）" },
  { group: "固定費", unit: "yen", key: "fixed_cost_hq", value: 0, description: "本部 月次固定費" },
  // イベント営業
  { group: "イベント営業", unit: "yen", key: "sales_bar_inc_threshold", value: 1000000, description: "BARインセン発動の単月事業部営業利益" },
  { group: "イベント営業", unit: "rate", key: "sales_bar_inc_rate", value: 0.1, description: "BARインセン率（BAR売上に対して）" },
  { group: "イベント営業", unit: "months", key: "sales_bar_pay_offset", value: 1, description: "BARインセン支給月（発生月の何ヶ月後の末日）" },
  { group: "イベント営業", unit: "rate", key: "sales_half_base_rate", value: 0.1, description: "半期ボーナス基本率（事業部営業利益に対して）" },
  { group: "イベント営業", unit: "rate", key: "sales_half_excess_rate", value: 0.2, description: "半期ボーナス 目標超過分の率" },
  { group: "イベント営業", unit: "yen", key: "sales_half_target_h1", value: 8120000, description: "上期 営業利益目標（0なら事業計画の合計）" },
  { group: "イベント営業", unit: "yen", key: "sales_half_target_h2", value: 0, description: "下期 営業利益目標（0なら事業計画の合計）" },
  // 人材
  { group: "人材", unit: "rate", key: "hr_masterkey_rate", value: 0.2, description: "マスターキー手数料率" },
  { group: "人材", unit: "yen", key: "hr_placement_ad_fee", value: 10000, description: "入社決定手当（広告・自社経由）" },
  { group: "人材", unit: "yen", key: "hr_placement_ref_fee", value: 30000, description: "入社決定手当（リファーラル経由）" },
  { group: "人材", unit: "months", key: "hr_placement_pay_offset", value: 1, description: "決定手当 支給月（決定月の何ヶ月後の末日）" },
  { group: "人材", unit: "rate", key: "hr_dept_bonus_rate", value: 0.03, description: "統括 事業部ボーナス率（目標まで）" },
  { group: "人材", unit: "rate", key: "hr_dept_bonus_excess_rate", value: 0.05, description: "統括 事業部ボーナス率（目標超過分）" },
  { group: "人材", unit: "yen", key: "hr_half_target_h1", value: 10425000, description: "上期 営業利益目標（0なら事業計画の合計）" },
  { group: "人材", unit: "yen", key: "hr_half_target_h2", value: 0, description: "下期 営業利益目標（0なら事業計画の合計）" },
  { group: "人材", unit: "rate", key: "hr_personal_bonus_rate", value: 0.15, description: "個人PLボーナス率（個人営業利益に対して）" },
  { group: "人材", unit: "yen", key: "hr_personal_fixed_cost", value: 200000, description: "個人PLの月次固定費配賦額" },
  // 運送
  { group: "運送", unit: "rate", key: "logi_inc_rate", value: 0.15, description: "統括 インセン率（大和利益に対して・合計）" },
  { group: "運送", unit: "rate", key: "logi_inc_monthly_rate", value: 0.1, description: "うち月次支給分（残りは半期プール）" },
  { group: "運送", unit: "months", key: "logi_inc_pay_offset", value: 2, description: "月次分の支給月（発生月の何ヶ月後）" },
  { group: "運送", unit: "day", key: "logi_inc_pay_day", value: 15, description: "月次分の支給日（0なら末日）" },
  // リファーラル
  { group: "リファーラル", unit: "rate", key: "ref_split_hr_default", value: 0.5, description: "転職支援 紹介元配分率（登録時の既定値）" },
  { group: "リファーラル", unit: "rate", key: "ref_split_moving_default", value: 0.8, description: "引越し 紹介元配分率（登録時の既定値）" },
  // 全社目標
  { group: "全社目標", unit: "yen", key: "company_annual_op_target", value: 50000000, description: "年間営業利益目標（下限）" },
  { group: "全社目標", unit: "yen", key: "company_annual_op_stretch", value: 60000000, description: "年間営業利益目標（ストレッチ）" },
  { group: "全社目標", unit: "months", key: "half_bonus_pay_offset", value: 1, description: "半期ボーナス支給月（半期末の何ヶ月後の末日）" },
];

export const PARAM_DEF_BY_KEY: Record<string, ParamDef> = Object.fromEntries(DEFAULT_PARAMS.map((p) => [p.key, p]));
