import { getRoleUser } from "@/lib/roleSession";
import DashboardShell from "@/components/dashboardShell";

export default async function ExaminerLayout({ children }) {
  const user = await getRoleUser("examiner");
  return <DashboardShell user={user}>{children}</DashboardShell>;
}
