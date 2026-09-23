import { authMode } from "@/lib/auth";
import { TERM_MONTHS } from "@/lib/constants";
import { getRepository } from "@/lib/db/repository";
import { handle, requireUser, todayJST } from "@/lib/server/context";
import { buildDashboard } from "@/lib/view-model";

export async function GET(request: Request) {
  return handle(async () => {
    const { db, me } = await requireUser();
    const today = todayJST();
    const url = new URL(request.url);
    const requested = url.searchParams.get("month");
    const fallback = TERM_MONTHS.find((m) => m.key === today.slice(0, 7))?.key ?? TERM_MONTHS[0].key;
    const month = TERM_MONTHS.some((m) => m.key === requested) ? requested! : fallback;
    const data = buildDashboard(db, me, month, { today, dataSource: getRepository().kind, authMode: authMode() });
    return Response.json(data);
  });
}
