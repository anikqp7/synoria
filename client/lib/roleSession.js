import "server-only";

import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { dashboardForRole } from "@/lib/roles";

export async function getRoleUser(role) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/");
  if ((session.user.role || "department") !== role) redirect(dashboardForRole(session.user.role));
  return session.user;
}
