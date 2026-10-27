import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { dashboardForRole } from "@/lib/roles";

export const metadata = { title: "Department Dashboard | Synoria" };

export default async function DashboardLayout({ children }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/");
  if (session.user.role && session.user.role !== "department") redirect(dashboardForRole(session.user.role));
  return children;
}
