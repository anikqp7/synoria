import { getRoleUser } from "@/lib/roleSession";
import MemberProfile from "@/components/memberProfile";

export const metadata = { title: "Examiner Profile | Synoria" };

export default async function AccountPage() {
  const profile = await getRoleUser("examiner");
  return <MemberProfile ownProfile profile={profile} role="examiner" department={{ name: profile.departmentName, university: profile.university }} />;
}
