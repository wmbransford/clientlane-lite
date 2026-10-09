import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { readState, workspaceFor } from "@/lib/crm";
import { CrmApp } from "@/components/crm-app";
export const dynamic = "force-dynamic";
export default async function Workspace() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");
  const workspace = workspaceFor(session.user);
  return <CrmApp initial={readState(workspace)} userName={session.user.name} />;
}
