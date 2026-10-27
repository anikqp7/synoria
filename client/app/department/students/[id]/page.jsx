import DepartmentMemberProfile from "@/components/departmentMemberProfile";

export const metadata = { title: "Student Profile | Synoria" };

export default async function ProfilePage({ params }) {
  const { id } = await params;
  return <DepartmentMemberProfile role="student" id={id} />;
}
