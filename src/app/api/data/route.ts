import { getRepository } from "@/lib/db/repository";
import { handle, HttpError, requireUser } from "@/lib/server/context";

// スプレッドシート全データの取得（ADMIN のみ。バックアップ・デバッグ用）
export async function GET() {
  return handle(async () => {
    const { db, me } = await requireUser();
    if (me.role !== "ADMIN") throw new HttpError(403, "権限がありません");
    return Response.json({ source: getRepository().kind, data: db });
  });
}
