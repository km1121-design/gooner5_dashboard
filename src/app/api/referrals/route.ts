import { getRepository, nextId } from "@/lib/db/repository";
import { handle, HttpError, num, oneOf, requireUser, str, ym } from "@/lib/server/context";
import type { CrossReferral } from "@/lib/types";

// 事業部間リファーラル（送客）の登録。紹介元配分率で売上を振り替える
export async function POST(request: Request) {
  return handle(async () => {
    const { db, me } = await requireUser();
    const body = await request.json();
    const fromId = str(body.from_member_id, "紹介元担当者", { required: true });
    const from = db.members.find((m) => m.member_id === fromId && m.is_active);
    if (!from) throw new HttpError(400, "紹介元担当者が見つかりません");
    const allowed = me.role === "ADMIN" || from.member_id === me.member_id || (me.role === "LEADER" && from.department === me.department);
    if (!allowed) throw new HttpError(403, "この担当者のリファーラルは登録できません");
    const toDept = oneOf(body.to_dept, ["SALES", "HR", "LOGI", "EXTERNAL"] as const, "送客先");
    if (toDept === from.department) throw new HttpError(400, "送客先が紹介元と同じ事業部です");

    const ref: CrossReferral = {
      ref_id: nextId(db.referrals.map((r) => r.ref_id), "REF"),
      year_month: ym(body.year_month, "対象年月"),
      from_member_id: fromId,
      to_dept: toDept,
      client_name: str(body.client_name, "案件名", { required: true }),
      gross_amount: num(body.gross_amount, "成立総売上", { min: 0, max: 1e10 }),
      split_rate: num(body.split_rate, "紹介元配分率", { min: 0, max: 1 }),
      status: me.role === "ADMIN" ? "APPROVED" : "PENDING",
    };
    await getRepository().insert("referrals", ref);
    return Response.json({ ok: true, referral: ref });
  });
}
