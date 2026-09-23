import { cookies } from "next/headers";
import { authMode, SESSION_COOKIE } from "@/lib/auth";
import { getRepository } from "@/lib/db/repository";
import { handle, HttpError, str } from "@/lib/server/context";

// 開発用の視点切替（AUTH_MODE=dev のときのみ）
export async function POST(request: Request) {
  return handle(async () => {
    if (authMode() !== "dev") throw new HttpError(403, "視点切替は開発モードでのみ利用できます");
    const body = await request.json();
    const id = str(body.member_id, "member_id", { required: true });
    const db = await getRepository().load();
    if (!db.members.some((m) => m.member_id === id && m.is_active)) throw new HttpError(404, "メンバーが見つかりません");
    (await cookies()).set(SESSION_COOKIE, id, { httpOnly: true, sameSite: "lax", path: "/" });
    return Response.json({ ok: true });
  });
}
