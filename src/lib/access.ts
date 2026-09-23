// 権限マトリクス（仕様書 §5 RBAC）。サーバー・クライアント共通。
import type { BusinessDept, Dept, Member, SalesTransaction } from "./types";

/** PL を閲覧できる事業部 */
export function visibleDepts(user: Member): Dept[] {
  if (user.role === "ADMIN") return ["SALES", "HR", "LOGI", "HQ"];
  if (user.role === "LEADER") return [user.department];
  return [];
}

/** 給与見立て（基本給・インセン・ボーナス）を閲覧できるか。本人と ADMIN のみ */
export function canSeePay(user: Member, target: Member): boolean {
  return user.role === "ADMIN" || user.member_id === target.member_id;
}

/** 実績（売上明細）を閲覧できるか */
export function canSeeMemberActivity(user: Member, target: Member): boolean {
  if (user.role === "ADMIN" || user.member_id === target.member_id) return true;
  return user.role === "LEADER" && user.department === target.department;
}

export function canSeeTransaction(user: Member, tx: Pick<SalesTransaction, "department" | "member_id">): boolean {
  if (user.role === "ADMIN" || tx.member_id === user.member_id) return true;
  return user.role === "LEADER" && tx.department === user.department;
}

/** 誰の実績として報告できるか */
export function canReportFor(user: Member, target: Member, dept: BusinessDept): boolean {
  if (user.role === "ADMIN") return true;
  if (user.department !== dept) return false;
  if (user.role === "LEADER") return target.department === dept;
  return target.member_id === user.member_id;
}

/** 承認できるか。ADMIN は全件、LEADER は自事業部の他メンバー分（自己承認は不可） */
export function canApprove(user: Member, tx: Pick<SalesTransaction, "department" | "member_id">): boolean {
  if (user.role === "ADMIN") return true;
  return user.role === "LEADER" && tx.department === user.department && tx.member_id !== user.member_id;
}

export function canEditMaster(user: Member): boolean {
  return user.role === "ADMIN";
}
