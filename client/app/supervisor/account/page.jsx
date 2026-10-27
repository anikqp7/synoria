import { getRoleUser } from "@/lib/roleSession";
import MemberProfile from "@/components/memberProfile";

export const metadata = { title: "Supervisor Profile | Synoria" };

export default async function AccountPage() {
  const profile = await getRoleUser("supervisor");
  return <MemberProfile ownProfile profile={profile} role="supervisor" department={{ name: profile.departmentName, university: profile.university }} />;
}
