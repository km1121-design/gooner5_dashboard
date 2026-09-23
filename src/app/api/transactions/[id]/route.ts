import { canApprove } from "@/lib/access";
import { getRepository } from "@/lib/db/repository";
import { handle, HttpError, nowISO, oneOf, requireUser, str } from "@/lib/server/context";

// 承認 / 差戻し
export async function PATCH(request: Request, ctx: RouteContext<"/api/transactions/[id]">) {
  return handle(async () => {
    const { id } = await ctx.params;
    const { db, me } = await requireUser();
    const tx = db.transactions.find((t) => t.tx_id === id);
    if (!tx) throw new HttpError(404, "伝票が見つかりません");
    if (!canApprove(me, tx)) throw new HttpError(403, "この伝票を承認する権限がありません");
    const body = await request.json();
    const action = oneOf(body.action, ["approve", "reject"] as const, "action");
    const reason = str(body.reason, "差戻し理由", { max: 300 });
    const updated = {
      ...tx,
      status: action === "approve" ? ("APPROVED" as const) : ("REJECTED" as const),
      approved_by: me.member_id,
      approved_at: nowISO(),
      notes: action === "reject" && reason ? `${tx.notes ? tx.notes + " / " : ""}差戻し: ${reason}` : tx.notes,
    };
    await getRepository().upsert("transactions", [updated]);
    return Response.json({ ok: true, transaction: updated });
  });
}
