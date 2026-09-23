import { canReportFor } from "@/lib/access";
import { BUSINESS_DEPTS } from "@/lib/constants";
import { getRepository, nextId } from "@/lib/db/repository";
import { handle, HttpError, nowISO, num, oneOf, requireUser, str, ymd } from "@/lib/server/context";
import type { SalesTransaction } from "@/lib/types";

// 売上実績の現場報告。ADMIN の登録は即時確定、それ以外は承認待ち（PENDING）
export async function POST(request: Request) {
  return handle(async () => {
    const { db, me } = await requireUser();
    const body = await request.json();
    const department = oneOf(body.department, BUSINESS_DEPTS, "事業部");
    const memberId = str(body.member_id, "担当者", { required: true });
    const target = db.members.find((m) => m.member_id === memberId && m.is_active);
    if (!target) throw new HttpError(400, "担当者が見つかりません");
    if (!canReportFor(me, target, department)) throw new HttpError(403, "この担当者・事業部の実績は登録できません");

    const date = ymd(body.date, "計上日");
    const autoApprove = me.role === "ADMIN";
    const tx: SalesTransaction = {
      tx_id: nextId(db.transactions.map((t) => t.tx_id), "TX"),
      year_month: date.slice(0, 7),
      date,
      department,
      member_id: memberId,
      category: str(body.category, "区分", { required: true, max: 50 }),
      title: str(body.title, "案件内容", { required: true }),
      gross_sales: num(body.gross_sales, "売上金額", { min: 0, max: 1e10 }),
      direct_cost: num(body.direct_cost ?? 0, "直接経費", { min: 0, max: 1e10 }),
      lead_source: oneOf(body.lead_source ?? "DIRECT", ["DIRECT", "AD", "REFERRAL"] as const, "流入経路"),
      notes: str(body.notes, "備考", { max: 500 }),
      status: autoApprove ? "APPROVED" : "PENDING",
      created_by: me.member_id,
      created_at: nowISO(),
      approved_by: autoApprove ? me.member_id : "",
      approved_at: autoApprove ? nowISO() : "",
    };
    await getRepository().insert("transactions", tx);
    return Response.json({ ok: true, transaction: tx });
  });
}
