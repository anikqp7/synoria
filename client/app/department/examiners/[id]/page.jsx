import DepartmentMemberProfile from "@/components/departmentMemberProfile";

export const metadata = { title: "Examiner Profile | Synoria" };

export default async function ProfilePage({ params }) {
  const { id } = await params;
  return <DepartmentMemberProfile role="examiner" id={id} />;
}
