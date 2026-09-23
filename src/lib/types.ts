// スプレッドシートDBスキーマ（仕様書 §3）に対応する型定義。
// 仕様書からの拡張は「★」で示す。

export type Dept = "SALES" | "HR" | "LOGI" | "HQ";
export type BusinessDept = Exclude<Dept, "HQ">;
export type Role = "ADMIN" | "LEADER" | "MEMBER";
export type LeadSource = "DIRECT" | "AD" | "REFERRAL";
/** ★ 現場報告 → 管理者確定 のための承認ステータス */
export type TxStatus = "PENDING" | "APPROVED" | "REJECTED";
/** ★ リファーラル送客先。EXTERNAL は社外パートナー（引越し業者など） */
export type ReferralTarget = BusinessDept | "EXTERNAL";

/** 01_M_メンバー */
export interface Member {
  member_id: string;
  name: string;
  department: Dept;
  role: Role;
  base_salary: number;
  is_active: boolean;
  /** ★ ログイン（Googleアカウント）との紐付け用 */
  email: string;
}

/** 02_M_事業計画 */
export interface MonthlyPlan {
  plan_id: string; // YYYY-MM_DEPT
  year_month: string;
  department: Dept;
  target_sales: number;
  target_op: number;
}

/** 03_M_設定パラメータ */
export interface ConfigParam {
  config_key: string;
  config_value: number;
  description: string;
}

/** 04_T_売上実績 */
export interface SalesTransaction {
  tx_id: string;
  year_month: string;
  date: string;
  department: BusinessDept;
  member_id: string;
  category: string;
  title: string;
  gross_sales: number;
  direct_cost: number;
  lead_source: LeadSource;
  notes: string;
  /** ★ 承認フロー */
  status: TxStatus;
  created_by: string;
  created_at: string;
  approved_by: string;
  approved_at: string;
}

/** 05_T_経費実績 */
export interface ExpenseTransaction {
  exp_id: string;
  year_month: string;
  department: Dept;
  category: string;
  amount: number;
  description: string;
}

/** 06_T_リファーラル */
export interface CrossReferral {
  ref_id: string;
  year_month: string;
  from_member_id: string;
  to_dept: ReferralTarget;
  client_name: string;
  gross_amount: number;
  split_rate: number;
  /** ★ 承認フロー（売上実績と同じ） */
  status: TxStatus;
}

export interface Database {
  members: Member[];
  plans: MonthlyPlan[];
  params: ConfigParam[];
  transactions: SalesTransaction[];
  expenses: ExpenseTransaction[];
  referrals: CrossReferral[];
}
