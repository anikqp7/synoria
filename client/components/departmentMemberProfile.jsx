import Link from "next/link";
import { cookies, headers } from "next/headers";
import { getToken } from "next-auth/jwt";
import { notFound } from "next/navigation";
import { getRoleUser } from "@/lib/roleSession";
import MemberProfile from "@/components/memberProfile";
import SupervisorCapacity from "@/components/supervisorCapacity";
import MemberManager from "@/components/memberManager";
import SignOutButton from "@/components/signOutButton";

export default async function DepartmentMemberProfile({ role, id }) {
  const department = await getRoleUser("department");
  if (!/^[a-f0-9]{24}$/i.test(id)) notFound();
  const resource = `${role}s`;
  const label = role.charAt(0).toUpperCase() + role.slice(1);
  const cookieStore = await cookies();
  const token = await getToken({ req: { cookies: Object.fromEntries(cookieStore.getAll().map(cookie => [cookie.name, cookie.value])), headers: Object.fromEntries(await headers()) } });
  let profile;
  let error;
  let expired = !token?.backendCookie;
  if (!expired) {
    let response;
    try {
      response = await fetch(`${process.env.API_URL || "http://127.0.0.1:4000"}/api/auth/${resource}/${encodeURIComponent(id)}`, {
        headers: { Cookie: token.backendCookie }, cache: "no-store", signal: AbortSignal.timeout(10000),
      });
    } catch { error = "Unable to load this profile. Please try again."; }
    const jsonResponse = response?.headers.get("content-type")?.includes("application/json");
    // Express's HTML 404 means the API route is unavailable, not a missing profile.
    if ((response?.status === 404 && jsonResponse) || response?.status === 403) notFound();
    if (response?.status === 401) expired = true;
    else if (response?.ok) profile = (await response.json())[role];
    else if (response) error = "Unable to load this profile. Please try again.";
  }

  const backLink = <Link href={`/department/${resource}`} className="inline-flex items-center gap-2 text-sm text-primary hover:underline"><span aria-hidden="true">←</span> Back To {`${label}s`}</Link>;
  if (expired || !profile) return <div className="mx-auto max-w-[1240px] px-[5%] py-10">{backLink}<div className="mt-6 rounded-panel border border-border bg-surface p-6"><h1 className="text-xl font-semibold">{expired ? "Please sign in again" : "Profile unavailable"}</h1><p className="text-text-secondary">{expired ? "Your session has expired. Sign out, then sign in to view this profile." : error}</p>{expired && <div className="max-w-40"><SignOutButton /></div>}</div></div>;

  return <><MemberProfile profile={profile} role={role} department={department} backHref={`/department/${resource}`} actions={<MemberManager role={role} profile={profile} />} />{role === "supervisor" && <div className="mx-auto max-w-[1240px] px-[5%] pb-10"><SupervisorCapacity supervisorId={profile.id} /></div>}</>;
}
