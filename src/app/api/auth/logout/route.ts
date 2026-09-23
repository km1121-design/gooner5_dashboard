import { cookies } from "next/headers";
import { DEV_COOKIE, SESSION_COOKIE } from "@/lib/auth";

export async function POST(request: Request) {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
  store.delete(DEV_COOKIE);
  const base = (process.env.APP_URL ?? new URL(request.url).origin).replace(/\/$/, "");
  return Response.redirect(`${base}/login?logged_out=1`, 303);
}
