import { canEditMaster } from "@/lib/access";
import { ALL_DEPTS } from "@/lib/constants";
import { getRepository } from "@/lib/db/repository";
import { handle, HttpError, num, oneOf, requireUser, str, ym } from "@/lib/server/context";
import type { ConfigParam, Member, MonthlyPlan } from "@/lib/types";

// マスター設定（事業計画・設定パラメータ・メンバー）の更新。ADMIN のみ
export async function PUT(request: Request) {
  return handle(async () => {
    const { me } = await requireUser();
    if (!canEditMaster(me)) throw new HttpError(403, "マスター設定を変更する権限がありません");
    const body = await request.json();
    const repo = getRepository();

    if (Array.isArray(body.plans)) {
      const plans: MonthlyPlan[] = body.plans.map((p: Record<string, unknown>) => {
        const year_month = ym(p.year_month, "対象年月");
        const department = oneOf(p.department, ALL_DEPTS, "事業部");
        return {
          plan_id: `${year_month}_${department}`,
          year_month,
          department,
          target_sales: num(p.target_sales, "目標売上"),
          target_op: num(p.target_op, "目標営業利益"),
        };
      });
      await repo.upsert("plans", plans);
    }

    if (Array.isArray(body.params)) {
      const params: ConfigParam[] = body.params.map((p: Record<string, unknown>) => ({
        config_key: str(p.config_key, "設定キー", { required: true, max: 80 }),
        config_value: num(p.config_value, "設定値"),
        description: str(p.description, "説明"),
      }));
      await repo.upsert("params", params);
    }

    if (Array.isArray(body.members)) {
      const members: Member[] = body.members.map((m: Record<string, unknown>) => ({
        member_id: str(m.member_id, "メンバーID", { required: true, max: 40 }),
        name: str(m.name, "氏名", { required: true, max: 80 }),
        department: oneOf(m.department, ALL_DEPTS, "所属"),
        role: oneOf(m.role, ["ADMIN", "LEADER", "MEMBER"] as const, "権限"),
        base_salary: num(m.base_salary, "基本給", { min: 0 }),
        is_active: Boolean(m.is_active),
        email: str(m.email, "メール", { max: 200 }),
      }));
      const current = (await repo.load()).members;
      const merged = [...current.filter((c) => !members.some((m) => m.member_id === c.member_id)), ...members];
      if (!merged.some((m) => m.role === "ADMIN" && m.is_active)) throw new HttpError(400, "有効な ADMIN が1名以上必要です");
      await repo.upsert("members", members);
    }
    return Response.json({ ok: true });
  });
}
