import { getRoleUser } from "@/lib/roleSession";
import DashboardShell from "@/components/dashboardShell";

export default async function DepartmentLayout({ children }) {
  const user = await getRoleUser("department");
  return <DashboardShell user={user}>{children}</DashboardShell>;
}
