import DepartmentMemberProfile from "@/components/departmentMemberProfile";

export const metadata = { title: "Supervisor Profile | Synoria" };

export default async function ProfilePage({ params }) {
  const { id } = await params;
  return <DepartmentMemberProfile role="supervisor" id={id} />;
}
