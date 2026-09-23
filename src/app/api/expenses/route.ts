import { ALL_DEPTS } from "@/lib/constants";
import { getRepository, nextId } from "@/lib/db/repository";
import { handle, HttpError, num, oneOf, requireUser, str, ym } from "@/lib/server/context";
import type { ExpenseTransaction } from "@/lib/types";

// 経費実績の登録（ADMIN: 全事業部 / LEADER: 自事業部）
export async function POST(request: Request) {
  return handle(async () => {
    const { db, me } = await requireUser();
    const body = await request.json();
    const department = oneOf(body.department, ALL_DEPTS, "事業部");
    if (!(me.role === "ADMIN" || (me.role === "LEADER" && me.department === department))) {
      throw new HttpError(403, "この事業部の経費は登録できません");
    }
    const exp: ExpenseTransaction = {
      exp_id: nextId(db.expenses.map((e) => e.exp_id), "EXP"),
      year_month: ym(body.year_month, "対象年月"),
      department,
      category: str(body.category, "科目", { required: true, max: 50 }),
      amount: num(body.amount, "金額", { min: -1e10, max: 1e10 }),
      description: str(body.description, "摘要"),
    };
    await getRepository().insert("expenses", exp);
    return Response.json({ ok: true, expense: exp });
  });
}
