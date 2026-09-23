// Finance Engine（仕様書 §4）
// DB（スプレッドシートの内容）を入力に、事業部PL・インセンティブ・半期ボーナスを算出する純粋関数群。
// サーバー（APIでの権限別集計）とクライアント（表示用の再計算）の双方から利用する。

import { DEFAULT_PARAMS, HALF_MONTHS, TERM_MONTHS, type Half } from "./constants";
import type { BusinessDept, ConfigParam, Database, Dept, Member } from "./types";

export type ParamMap = Record<string, number>;

export function buildParams(params: ConfigParam[]): ParamMap {
  const map: ParamMap = {};
  for (const p of DEFAULT_PARAMS) map[p.key] = p.value;
  for (const p of params) {
    if (p.config_key && Number.isFinite(p.config_value)) map[p.config_key] = p.config_value;
  }
  return map;
}

// ---------------------------------------------------------------- 日付ユーティリティ

export function addMonths(ym: string, n: number): string {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function daysInMonth(ym: string): number {
  const [y, m] = ym.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export function halfOf(ym: string): Half {
  return HALF_MONTHS.H1.includes(ym) ? "H1" : "H2";
}

const round = (v: number) => Math.round(v);

export function payDayLabel(day: number): string {
  return day >= 1 && day <= 31 ? `${Math.round(day)}日` : "末日";
}

// ---------------------------------------------------------------- 事業部PL

export interface DeptMonthPL {
  dept: Dept;
  month: string;
  /** 承認済み売上実績の合計（04_T_売上実績） */
  grossSales: number;
  /** 自事業部メンバーが紹介元となったリファーラル配分（06_T_リファーラル） */
  referralCredit: number;
  /** 自事業部が送客先となったリファーラルの紹介元への振替 */
  referralDebit: number;
  /** PL上の売上 = grossSales + referralCredit - referralDebit */
  sales: number;
  directCost: number;
  masterKeyFee: number;
  fixedCost: number;
  expenses: number;
  expenseBreakdown: Record<string, number>;
  totalCost: number;
  op: number;
  planSales: number;
  planOP: number;
  planCost: number;
  txCount: number;
  pendingCount: number;
  pendingAmount: number;
  barSales: number;
  placements: number;
  hasData: boolean;
}

const FIXED_COST_KEY: Record<Dept, string> = {
  SALES: "fixed_cost_sales",
  HR: "fixed_cost_hr",
  LOGI: "fixed_cost_logi",
  HQ: "fixed_cost_hq",
};

export function memberDept(db: Database, memberId: string): Dept | undefined {
  return db.members.find((m) => m.member_id === memberId)?.department;
}

export function computeDeptMonth(db: Database, dept: Dept, month: string, params = buildParams(db.params)): DeptMonthPL {
  const txAll = db.transactions.filter((t) => t.department === dept && t.year_month === month);
  const tx = txAll.filter((t) => t.status === "APPROVED");
  const pending = txAll.filter((t) => t.status === "PENDING");
  const refs = db.referrals.filter((r) => r.year_month === month && r.status === "APPROVED");

  const grossSales = sum(tx.map((t) => t.gross_sales));
  const directCost = sum(tx.map((t) => t.direct_cost));
  const referralCredit = sum(
    refs.filter((r) => memberDept(db, r.from_member_id) === dept).map((r) => r.gross_amount * r.split_rate),
  );
  const referralDebit = sum(refs.filter((r) => r.to_dept === dept).map((r) => r.gross_amount * r.split_rate));
  const masterKeyFee = dept === "HR" ? grossSales * params.hr_masterkey_rate : 0;

  const exps = db.expenses.filter((e) => e.department === dept && e.year_month === month);
  const expenseBreakdown: Record<string, number> = {};
  for (const e of exps) expenseBreakdown[e.category] = (expenseBreakdown[e.category] ?? 0) + e.amount;
  const expenses = sum(exps.map((e) => e.amount));

  const fixedCost = params[FIXED_COST_KEY[dept]] ?? 0;
  const sales = grossSales + referralCredit - referralDebit;
  const totalCost = directCost + masterKeyFee + fixedCost + expenses;

  const plan = db.plans.find((p) => p.department === dept && p.year_month === month);
  const planSales = plan?.target_sales ?? 0;
  const planOP = plan?.target_op ?? 0;

  return {
    dept,
    month,
    grossSales: round(grossSales),
    referralCredit: round(referralCredit),
    referralDebit: round(referralDebit),
    sales: round(sales),
    directCost: round(directCost),
    masterKeyFee: round(masterKeyFee),
    fixedCost: round(fixedCost),
    expenses: round(expenses),
    expenseBreakdown,
    totalCost: round(totalCost),
    op: round(sales - totalCost),
    planSales,
    planOP,
    planCost: planSales - planOP,
    txCount: tx.length,
    pendingCount: pending.length,
    pendingAmount: sum(pending.map((t) => t.gross_sales)),
    barSales: dept === "SALES" ? sum(tx.filter((t) => t.category === "BAR売上").map((t) => t.gross_sales)) : 0,
    placements: dept === "HR" ? tx.filter((t) => t.category === "CA入社決定").length : 0,
    hasData: tx.length > 0 || exps.length > 0 || referralCredit > 0 || referralDebit > 0,
  };
}

export interface MonthPL {
  month: string;
  depts: Record<Dept, DeptMonthPL>;
  total: Omit<DeptMonthPL, "dept" | "expenseBreakdown">;
}

export function computeMonth(db: Database, month: string, params = buildParams(db.params), scope: Dept[] = ["SALES", "HR", "LOGI", "HQ"]): MonthPL {
  const depts = {} as Record<Dept, DeptMonthPL>;
  for (const d of ["SALES", "HR", "LOGI", "HQ"] as Dept[]) depts[d] = computeDeptMonth(db, d, month, params);
  const inScope = scope.map((d) => depts[d]);
  const total = {
    month,
    grossSales: sum(inScope.map((d) => d.grossSales)),
    referralCredit: sum(inScope.map((d) => d.referralCredit)),
    referralDebit: sum(inScope.map((d) => d.referralDebit)),
    sales: sum(inScope.map((d) => d.sales)),
    directCost: sum(inScope.map((d) => d.directCost)),
    masterKeyFee: sum(inScope.map((d) => d.masterKeyFee)),
    fixedCost: sum(inScope.map((d) => d.fixedCost)),
    expenses: sum(inScope.map((d) => d.expenses)),
    totalCost: sum(inScope.map((d) => d.totalCost)),
    op: sum(inScope.map((d) => d.op)),
    planSales: sum(inScope.map((d) => d.planSales)),
    planOP: sum(inScope.map((d) => d.planOP)),
    planCost: sum(inScope.map((d) => d.planCost)),
    txCount: sum(inScope.map((d) => d.txCount)),
    pendingCount: sum(inScope.map((d) => d.pendingCount)),
    pendingAmount: sum(inScope.map((d) => d.pendingAmount)),
    barSales: depts.SALES.barSales,
    placements: depts.HR.placements,
    hasData: inScope.some((d) => d.hasData),
  };
  return { month, depts, total };
}

/** 半期の事業部営業利益。forecast=true の場合、throughMonth より後の月は計画値で補完（着地見込み） */
export function halfDeptOP(db: Database, dept: Dept, half: Half, throughMonth: string, forecast: boolean, params = buildParams(db.params)) {
  let actual = 0;
  let projected = 0;
  let plan = 0;
  for (const m of HALF_MONTHS[half]) {
    const pl = computeDeptMonth(db, dept, m, params);
    plan += pl.planOP;
    if (m <= throughMonth) actual += pl.op;
    else if (forecast) projected += pl.planOP;
  }
  return { actual, projected, total: actual + projected, plan };
}

// ---------------------------------------------------------------- インセンティブ（月次支給）

export type IncentiveKind = "BAR" | "HR_PLACEMENT" | "LOGI_MONTHLY";

export interface IncentiveItem {
  id: string;
  member_id: string;
  kind: IncentiveKind;
  label: string;
  earned_month: string;
  pay_month: string;
  /** 表示用の支給日（"末日" / "15日" など） */
  pay_day: string;
  amount: number;
  basis: string;
}

export function findLeader(db: Database, dept: Dept): Member | undefined {
  return db.members.find((m) => m.department === dept && m.role === "LEADER" && m.is_active);
}

/** 指定月に「発生」したインセンティブ（支給月・支給日は設定パラメータで変更可能） */
export function computeIncentivesEarned(db: Database, month: string, params = buildParams(db.params)): IncentiveItem[] {
  const items: IncentiveItem[] = [];

  // 1. イベント営業: 単月事業部営業利益 >= 閾値 で BAR売上 × 率 を翌月末支給
  const sales = computeDeptMonth(db, "SALES", month, params);
  const salesLeader = findLeader(db, "SALES");
  if (salesLeader && sales.op >= params.sales_bar_inc_threshold && sales.barSales > 0) {
    items.push({
      id: `BAR_${month}`,
      member_id: salesLeader.member_id,
      kind: "BAR",
      label: "BARインセンティブ",
      earned_month: month,
      pay_month: addMonths(month, params.sales_bar_pay_offset),
      pay_day: "末日",
      amount: round(sales.barSales * params.sales_bar_inc_rate),
      basis: `BAR売上 ${yen(sales.barSales)} × ${pct(params.sales_bar_inc_rate)}（事業部利益 ${yen(sales.op)} ≥ ${yen(params.sales_bar_inc_threshold)}）`,
    });
  }

  // 2. 人材: 入社決定手当（広告・自社=1万 / リファーラル=3万）を翌月末支給
  for (const t of db.transactions) {
    if (t.department !== "HR" || t.year_month !== month || t.status !== "APPROVED" || t.category !== "CA入社決定") continue;
    const isRef = t.lead_source === "REFERRAL";
    items.push({
      id: `PLC_${t.tx_id}`,
      member_id: t.member_id,
      kind: "HR_PLACEMENT",
      label: `決定手当（${isRef ? "リファーラル" : "広告・自社"}）`,
      earned_month: month,
      pay_month: addMonths(month, params.hr_placement_pay_offset),
      pay_day: "末日",
      amount: isRef ? params.hr_placement_ref_fee : params.hr_placement_ad_fee,
      basis: t.title,
    });
  }

  // 3. 運送: 大和利益 × 15% のうち 10% を翌々月15日支給（残り5%は半期プール）
  const logi = computeDeptMonth(db, "LOGI", month, params);
  const logiLeader = findLeader(db, "LOGI");
  if (logiLeader && logi.op > 0) {
    items.push({
      id: `LOGI_${month}`,
      member_id: logiLeader.member_id,
      kind: "LOGI_MONTHLY",
      label: "大和利益インセンティブ（月次分）",
      earned_month: month,
      pay_month: addMonths(month, params.logi_inc_pay_offset),
      pay_day: payDayLabel(params.logi_inc_pay_day),
      amount: round(logi.op * params.logi_inc_monthly_rate),
      basis: `大和利益 ${yen(logi.op)} × ${pct(params.logi_inc_monthly_rate)}`,
    });
  }
  return items;
}

/** 期内の全インセンティブ（前期末月分の翌月/翌々月支給も含むよう期全体を走査） */
export function computeAllIncentives(db: Database, params = buildParams(db.params)): IncentiveItem[] {
  return TERM_MONTHS.flatMap((m) => computeIncentivesEarned(db, m.key, params));
}

// ---------------------------------------------------------------- 半期ボーナス

export type HalfBonusKind = "SALES_HALF" | "HR_DEPT" | "HR_PERSONAL" | "LOGI_POOL";

export interface HalfBonusItem {
  member_id: string;
  half: Half;
  kind: HalfBonusKind;
  label: string;
  amount: number;
  basis: string;
  pay_month: string;
}

function halfTarget(db: Database, dept: BusinessDept, half: Half, params: ParamMap): number {
  const key = `${dept.toLowerCase()}_half_target_${half.toLowerCase()}`;
  const v = params[key];
  if (v && v > 0) return v;
  return sum(db.plans.filter((p) => p.department === dept && HALF_MONTHS[half].includes(p.year_month)).map((p) => p.target_op));
}

/** 人材メンバーの個人営業利益 = 個人売上 − マスターキー − 直接経費 − 固定費配賦 */
export function computeHrPersonalOP(db: Database, memberId: string, months: string[], params = buildParams(db.params)) {
  let sales = 0;
  let masterKey = 0;
  let direct = 0;
  let alloc = 0;
  for (const m of months) {
    const tx = db.transactions.filter((t) => t.member_id === memberId && t.department === "HR" && t.year_month === m && t.status === "APPROVED");
    const s = sum(tx.map((t) => t.gross_sales));
    sales += s;
    masterKey += s * params.hr_masterkey_rate;
    direct += sum(tx.map((t) => t.direct_cost));
    alloc += params.hr_personal_fixed_cost;
  }
  return { sales, masterKey: round(masterKey), direct, alloc, op: round(sales - masterKey - direct - alloc) };
}

/**
 * 半期ボーナスの算出。
 * - forecast=false: throughMonth までの実績ベース（現時点の確定プール）
 * - forecast=true : 残り月を事業計画で補完した着地見込み
 */
export function computeHalfBonuses(db: Database, half: Half, throughMonth: string, forecast: boolean, params = buildParams(db.params)): HalfBonusItem[] {
  const items: HalfBonusItem[] = [];
  const months = HALF_MONTHS[half];
  const actualMonths = months.filter((m) => m <= throughMonth);
  const payMonth = addMonths(months[months.length - 1], params.half_bonus_pay_offset);

  // イベント営業: 事業部利益×10% − 支給済BARインセン ＋ 目標超過分×20%
  const salesLeader = findLeader(db, "SALES");
  if (salesLeader) {
    const op = halfDeptOP(db, "SALES", half, throughMonth, forecast, params).total;
    const target = halfTarget(db, "SALES", half, params);
    const paidBar = sum(actualMonths.flatMap((m) => computeIncentivesEarned(db, m, params)).filter((i) => i.kind === "BAR").map((i) => i.amount));
    const base = Math.max(0, op * params.sales_half_base_rate - paidBar);
    const excess = Math.max(0, op - target) * params.sales_half_excess_rate;
    items.push({
      member_id: salesLeader.member_id,
      half,
      kind: "SALES_HALF",
      label: "営業 半期ボーナス",
      amount: round(base + excess),
      basis: `半期利益 ${yen(op)} × ${pct(params.sales_half_base_rate)} − BARインセン ${yen(paidBar)}${excess > 0 ? ` ＋ 目標超過 ${yen(op - target)} × ${pct(params.sales_half_excess_rate)}` : `（目標 ${yen(target)} 未達）`}`,
      pay_month: payMonth,
    });
  }

  // 人材統括: 事業部利益×3%（目標まで）＋ 目標超過分×5%
  const hrLeader = findLeader(db, "HR");
  if (hrLeader) {
    const op = halfDeptOP(db, "HR", half, throughMonth, forecast, params).total;
    const target = halfTarget(db, "HR", half, params);
    const within = Math.max(0, Math.min(op, target));
    const over = Math.max(0, op - target);
    items.push({
      member_id: hrLeader.member_id,
      half,
      kind: "HR_DEPT",
      label: "人材 事業部ボーナス",
      amount: round(within * params.hr_dept_bonus_rate + over * params.hr_dept_bonus_excess_rate),
      basis: `目標内 ${yen(within)} × ${pct(params.hr_dept_bonus_rate)}${over > 0 ? ` ＋ 超過 ${yen(over)} × ${pct(params.hr_dept_bonus_excess_rate)}` : ""}（目標 ${yen(target)}）`,
      pay_month: payMonth,
    });
  }

  // 人材メンバー: 個人営業利益×15%（実績のみ。見込みでも未来月は加算しない）
  for (const m of db.members.filter((x) => x.department === "HR" && x.is_active)) {
    const p = computeHrPersonalOP(db, m.member_id, actualMonths, params);
    items.push({
      member_id: m.member_id,
      half,
      kind: "HR_PERSONAL",
      label: "個人PLボーナス",
      amount: round(Math.max(0, p.op) * params.hr_personal_bonus_rate),
      basis: `個人利益 ${yen(p.op)}（売上 ${yen(p.sales)} − MK ${yen(p.masterKey)} − 経費 ${yen(p.direct)} − 配賦 ${yen(p.alloc)}）× ${pct(params.hr_personal_bonus_rate)}`,
      pay_month: payMonth,
    });
  }

  // 運送統括: 大和利益×(15%−10%) を半期プール（月次で赤字の月は0）
  const logiLeader = findLeader(db, "LOGI");
  if (logiLeader) {
    const poolRate = params.logi_inc_rate - params.logi_inc_monthly_rate;
    let base = 0;
    for (const m of months) {
      const pl = computeDeptMonth(db, "LOGI", m, params);
      if (m <= throughMonth) base += Math.max(0, pl.op);
      else if (forecast) base += Math.max(0, pl.planOP);
    }
    items.push({
      member_id: logiLeader.member_id,
      half,
      kind: "LOGI_POOL",
      label: "大和利益 半期プール",
      amount: round(base * poolRate),
      basis: `大和利益累計 ${yen(base)} × ${pct(poolRate)}`,
      pay_month: payMonth,
    });
  }
  return items;
}

// ---------------------------------------------------------------- 個人の給与見立て

export interface PaySummary {
  month: string;
  base: number;
  items: IncentiveItem[];
  bonuses: HalfBonusItem[];
  total: number;
}

export interface MemberSummary {
  member: Member;
  month: string;
  personalSales: number;
  personalTxCount: number;
  pendingCount: number;
  /** 当月（selected month）に支給される額 */
  payThisMonth: PaySummary;
  /** 翌月に支給される見込み額 */
  payNextMonth: PaySummary;
  /** 当月に発生したインセンティブ（支給は後日） */
  earnedThisMonth: IncentiveItem[];
  half: Half;
  halfBonusActual: HalfBonusItem[];
  halfBonusForecast: HalfBonusItem[];
}

export function computeMemberSummary(
  db: Database,
  memberId: string,
  month: string,
  ctx?: { params?: ParamMap; incentives?: IncentiveItem[]; bonusesActual?: HalfBonusItem[]; bonusesForecast?: HalfBonusItem[]; prevHalfBonuses?: HalfBonusItem[] },
): MemberSummary | null {
  const member = db.members.find((m) => m.member_id === memberId);
  if (!member) return null;
  const params = ctx?.params ?? buildParams(db.params);
  const incentives = ctx?.incentives ?? computeAllIncentives(db, params);
  const half = halfOf(month);
  const bonusesActual = ctx?.bonusesActual ?? computeHalfBonuses(db, half, month, false, params);
  const bonusesForecast = ctx?.bonusesForecast ?? computeHalfBonuses(db, half, month, true, params);
  // 上期ボーナスは下期中（2月末）に支給されるため、支給月判定用に確定値を用意
  const settled = ctx?.prevHalfBonuses ?? (half === "H2" ? computeHalfBonuses(db, "H1", HALF_MONTHS.H1[5], false, params) : []);

  const mine = incentives.filter((i) => i.member_id === memberId);
  const pay = (m: string): PaySummary => {
    const items = mine.filter((i) => i.pay_month === m);
    const bonuses = settled.filter((b) => b.member_id === memberId && b.pay_month === m && b.amount > 0);
    return {
      month: m,
      base: member.base_salary,
      items,
      bonuses,
      total: member.base_salary + sum(items.map((i) => i.amount)) + sum(bonuses.map((b) => b.amount)),
    };
  };

  const tx = db.transactions.filter((t) => t.member_id === memberId && t.year_month === month);
  const approved = tx.filter((t) => t.status === "APPROVED");
  const refCredit = db.referrals
    .filter((r) => r.from_member_id === memberId && r.year_month === month && r.status === "APPROVED")
    .map((r) => r.gross_amount * r.split_rate);

  return {
    member,
    month,
    personalSales: round(sum(approved.map((t) => t.gross_sales)) + sum(refCredit)),
    personalTxCount: approved.length,
    pendingCount: tx.filter((t) => t.status === "PENDING").length,
    payThisMonth: pay(month),
    payNextMonth: pay(addMonths(month, 1)),
    earnedThisMonth: mine.filter((i) => i.earned_month === month),
    half,
    halfBonusActual: bonusesActual.filter((b) => b.member_id === memberId),
    halfBonusForecast: bonusesForecast.filter((b) => b.member_id === memberId),
  };
}

// ---------------------------------------------------------------- 日次進捗

export interface DailyPoint {
  day: number;
  daySales: number;
  cumulative: number;
  planLine: number;
}

export function computeDaily(db: Database, month: string, scope: Dept[], planSales: number) {
  const days = daysInMonth(month);
  const byDay = new Array<number>(days + 1).fill(0);
  for (const t of db.transactions) {
    if (t.year_month !== month || t.status !== "APPROVED" || !scope.includes(t.department)) continue;
    const d = Number(t.date.slice(8, 10));
    if (d >= 1 && d <= days) byDay[d] += t.gross_sales;
  }
  let cum = 0;
  const points: DailyPoint[] = [];
  for (let d = 1; d <= days; d++) {
    cum += byDay[d];
    points.push({ day: d, daySales: byDay[d], cumulative: cum, planLine: round((planSales / days) * d) });
  }
  return points;
}

/** 経過日数（today が対象月内ならその日、過去月なら月末日、未来月なら0） */
export function elapsedDays(month: string, today: string): number {
  const cur = today.slice(0, 7);
  if (month < cur) return daysInMonth(month);
  if (month > cur) return 0;
  return Number(today.slice(8, 10));
}

// ---------------------------------------------------------------- helpers

export function sum(values: number[]): number {
  let s = 0;
  for (const v of values) s += Number(v) || 0;
  return s;
}

function yen(v: number) {
  return `¥${round(v).toLocaleString("ja-JP")}`;
}

function pct(r: number) {
  return `${Math.round(r * 1000) / 10}%`;
}

