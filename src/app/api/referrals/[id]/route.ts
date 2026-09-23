import { getRepository } from "@/lib/db/repository";
import { handle, HttpError, oneOf, requireUser } from "@/lib/server/context";

// リファーラルは事業部をまたぐため本部（ADMIN）のみ承認可能
export async function PATCH(request: Request, ctx: RouteContext<"/api/referrals/[id]">) {
  return handle(async () => {
    const { id } = await ctx.params;
    const { db, me } = await requireUser();
    if (me.role !== "ADMIN") throw new HttpError(403, "リファーラルの承認は本部のみ可能です");
    const ref = db.referrals.find((r) => r.ref_id === id);
    if (!ref) throw new HttpError(404, "リファーラルが見つかりません");
    const body = await request.json();
    const action = oneOf(body.action, ["approve", "reject"] as const, "action");
    const updated = { ...ref, status: action === "approve" ? ("APPROVED" as const) : ("REJECTED" as const) };
    await getRepository().upsert("referrals", [updated]);
    return Response.json({ ok: true, referral: updated });
  });
}
