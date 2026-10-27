import { getRoleUser } from "@/lib/roleSession";
import DashboardShell from "@/components/dashboardShell";

export default async function StudentLayout({ children }) {
  const user = await getRoleUser("student");
  return <DashboardShell user={user}>{children}</DashboardShell>;
}
