import { getRoleUser } from "@/lib/roleSession";
import MemberProfile from "@/components/memberProfile";

export const metadata = { title: "Student Profile | Synoria" };

export default async function AccountPage() {
  const profile = await getRoleUser("student");
  return <MemberProfile ownProfile profile={profile} role="student" department={{ name: profile.departmentName, university: profile.university }} />;
}
