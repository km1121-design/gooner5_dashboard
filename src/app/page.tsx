import { redirect } from "next/navigation";
import { Dashboard } from "@/components/dashboard/dashboard";
import { authMode, getCurrentUser } from "@/lib/auth";
import { getRepository } from "@/lib/db/repository";

export default async function Page() {
  if (authMode() !== "dev") {
    const me = await getCurrentUser(await getRepository().load());
    if (!me) redirect("/login");
  }
  return <Dashboard />;
}
