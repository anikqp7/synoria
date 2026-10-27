import { getRoleUser } from "@/lib/roleSession";
import DashboardShell from "@/components/dashboardShell";

export default async function SupervisorLayout({ children }) {
  const user = await getRoleUser("supervisor");
  return <DashboardShell user={user}>{children}</DashboardShell>;
}
