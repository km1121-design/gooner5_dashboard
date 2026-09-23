// 権限別に絞り込んだダッシュボード表示データを組み立てる（サーバー側で実行）。
import { canApprove, canEditMaster, canReportFor, canSeeMemberActivity, canSeePay, canSeeTransaction, visibleDepts } from "./access";
import { BUSINESS_DEPTS, DEFAULT_PARAMS, HALF_MONTHS, TERM_MONTHS, type Half } from "./constants";
import {
  buildParams,
  computeAllIncentives,
  computeDaily,
  computeHalfBonuses,
  computeMemberSummary,
  computeMonth,
  daysInMonth,
  elapsedDays,
  halfOf,
  sum,
  type DailyPoint,
  type DeptMonthPL,
  type MemberSummary,
  type MonthPL,
  type ParamMap,
} from "./finance-engine";
import type { ConfigParam, CrossReferral, Database, Dept, ExpenseTransaction, Member, MonthlyPlan, SalesTransaction } from "./types";

export interface TrendPoint {
  month: string;
  short: string;
  half: Half;
  planSales: number;
  planOP: number;
  sales: number | null;
  op: number | null;
  cumPlanOP: number;
  cumOP: number | null;
  isFuture: boolean;
  byDept: Partial<Record<Dept, { sales: number; op: number }>>;
}

export interface PublicMember {
  member_id: string;
  name: string;
  department: Dept;
  role: Member["role"];
}

export interface TeamRow {
  member: PublicMember;
  sales: number;
  txCount: number;
  pendingCount: number;
}

export interface DashboardData {
  today: string;
  month: string;
  dataSource: "sheets" | "local";
  authMode: "dev" | "locked";
  me: Member;
  permissions: { master: boolean; approve: boolean; companyView: boolean };
  scope: Dept[];
  monthPL: { depts: Partial<Record<Dept, DeptMonthPL>>; total: MonthPL["total"] } | null;
  trend: TrendPoint[];
  halves: Record<Half, { planSales: number; planOP: number; sales: number; op: number; forecastOP: number }>;
  daily: { points: DailyPoint[]; elapsed: number; days: number };
  transactions: SalesTransaction[];
  referrals: CrossReferral[];
  expenses: ExpenseTransaction[];
  approvals: SalesTransaction[];
  referralApprovals: CrossReferral[];
  members: PublicMember[];
  reportableMembers: PublicMember[];
  summaries: MemberSummary[];
  team: TeamRow[];
  annualTarget: { min: number; stretch: number } | null;
  master: { plans: MonthlyPlan[]; params: ConfigParam[]; members: Member[] } | null;
  /** dev モードの視点切替用 */
  switchableMembers: PublicMember[];
  categories: Record<string, number>;
  /** インセンティブ規程の表示用（料率・閾値） */
  rules: ParamMap;
}

const toPublic = (m: Member): PublicMember => ({ member_id: m.member_id, name: m.name, department: m.department, role: m.role });

export function buildDashboard(
  db: Database,
  me: Member,
  month: string,
  opts: { today: string; dataSource: "sheets" | "local"; authMode: "dev" | "locked" },
): DashboardData {
  const params = buildParams(db.params);
  const scope = visibleDepts(me);
  const companyView = me.role === "ADMIN";
  const currentMonth = opts.today.slice(0, 7);

  // ---- 事業部PL（閲覧可能範囲のみ）
  let monthPL: DashboardData["monthPL"] = null;
  if (scope.length) {
    const full = computeMonth(db, month, params, scope);
    const depts: Partial<Record<Dept, DeptMonthPL>> = {};
    for (const d of scope) depts[d] = full.depts[d];
    monthPL = { depts, total: full.total };
  }

  // ---- 12ヶ月推移
  let cumPlan = 0;
  let cumOP = 0;
  const trend: TrendPoint[] = TERM_MONTHS.map((tm) => {
    const pl = computeMonth(db, tm.key, params, scope.length ? scope : []);
    const isFuture = tm.key > currentMonth;
    cumPlan += pl.total.planOP;
    if (!isFuture) cumOP += pl.total.op;
    const byDept: TrendPoint["byDept"] = {};
    for (const d of scope) byDept[d] = { sales: pl.depts[d].sales, op: pl.depts[d].op };
    return {
      month: tm.key,
      short: tm.short,
      half: tm.half,
      planSales: pl.total.planSales,
      planOP: pl.total.planOP,
      sales: isFuture ? null : pl.total.sales,
      op: isFuture ? null : pl.total.op,
      cumPlanOP: cumPlan,
      cumOP: isFuture ? null : cumOP,
      isFuture,
      byDept,
    };
  });
  const halves = {} as DashboardData["halves"];
  for (const h of ["H1", "H2"] as Half[]) {
    const pts = trend.filter((t) => HALF_MONTHS[h].includes(t.month));
    halves[h] = {
      planSales: sum(pts.map((p) => p.planSales)),
      planOP: sum(pts.map((p) => p.planOP)),
      sales: sum(pts.map((p) => p.sales ?? 0)),
      op: sum(pts.map((p) => p.op ?? 0)),
      forecastOP: sum(pts.map((p) => (p.isFuture ? p.planOP : (p.op ?? 0)))),
    };
  }

  // ---- 日次進捗（閲覧範囲の事業部、MEMBERは空）
  const planSales = monthPL?.total.planSales ?? 0;
  const daily = {
    points: scope.length ? computeDaily(db, month, scope, planSales) : [],
    elapsed: elapsedDays(month, opts.today),
    days: daysInMonth(month),
  };

  // ---- 明細
  const memberById = new Map(db.members.map((m) => [m.member_id, m]));
  const transactions = db.transactions.filter((t) => t.year_month === month && canSeeTransaction(me, t));
  const approvals = db.transactions.filter((t) => t.status === "PENDING" && canApprove(me, t));
  const refVisible = (r: CrossReferral) => {
    const from = memberById.get(r.from_member_id);
    return me.role === "ADMIN" || r.from_member_id === me.member_id || (me.role === "LEADER" && (from?.department === me.department || r.to_dept === me.department));
  };
  const referrals = db.referrals.filter((r) => r.year_month === month && refVisible(r));
  const referralApprovals = me.role === "ADMIN" ? db.referrals.filter((r) => r.status === "PENDING") : [];
  const expenses = db.expenses.filter((e) => e.year_month === month && scope.includes(e.department));

  // ---- 給与見立て（本人 + ADMINは全員）
  const incentives = computeAllIncentives(db, params);
  const half = halfOf(month);
  const bonusesActual = computeHalfBonuses(db, half, month, false, params);
  const bonusesForecast = computeHalfBonuses(db, half, month, true, params);
  const prevHalfBonuses = half === "H2" ? computeHalfBonuses(db, "H1", HALF_MONTHS.H1[5], false, params) : [];
  const summaries = db.members
    .filter((m) => m.is_active && canSeePay(me, m))
    .map((m) => computeMemberSummary(db, m.member_id, month, { params, incentives, bonusesActual, bonusesForecast, prevHalfBonuses }))
    .filter((s): s is MemberSummary => s !== null);

  // ---- チーム実績（LEADER: 自事業部メンバー、ADMIN: 全員）
  const team: TeamRow[] = db.members
    .filter((m) => m.is_active && m.department !== "HQ" && canSeeMemberActivity(me, m) && (me.role !== "MEMBER"))
    .map((m) => {
      const tx = db.transactions.filter((t) => t.member_id === m.member_id && t.year_month === month);
      const ok = tx.filter((t) => t.status === "APPROVED");
      return { member: toPublic(m), sales: sum(ok.map((t) => t.gross_sales)), txCount: ok.length, pendingCount: tx.length - ok.length };
    });

  const visibleMembers = db.members.filter((m) => canSeeMemberActivity(me, m) || m.role === "LEADER");
  const reportable = db.members.filter((m) => m.is_active && BUSINESS_DEPTS.some((d) => canReportFor(me, m, d)) && m.department !== "HQ");

  const categories: Record<string, number> = {};
  for (const t of transactions) if (t.status === "APPROVED") categories[t.category] = (categories[t.category] ?? 0) + t.gross_sales;

  return {
    today: opts.today,
    month,
    dataSource: opts.dataSource,
    authMode: opts.authMode,
    me,
    permissions: { master: canEditMaster(me), approve: me.role !== "MEMBER", companyView },
    scope,
    monthPL,
    trend,
    halves,
    daily,
    transactions,
    referrals,
    expenses,
    approvals,
    referralApprovals,
    members: visibleMembers.map(toPublic),
    reportableMembers: reportable.map(toPublic),
    summaries,
    team,
    annualTarget: companyView ? { min: params.company_annual_op_target, stretch: params.company_annual_op_stretch } : null,
    master: canEditMaster(me)
      ? {
          plans: db.plans,
          params: DEFAULT_PARAMS.map((d) => db.params.find((p) => p.config_key === d.key) ?? { config_key: d.key, config_value: d.value, description: d.description })
            .concat(db.params.filter((p) => !DEFAULT_PARAMS.some((d) => d.key === p.config_key))),
          members: db.members,
        }
      : null,
    switchableMembers: opts.authMode === "dev" ? db.members.filter((m) => m.is_active).map(toPublic) : [],
    categories,
    rules: companyView ? params : Object.fromEntries(Object.entries(params).filter(([k]) => !k.startsWith("fixed_cost") && !k.startsWith("company_"))),
  };
}
