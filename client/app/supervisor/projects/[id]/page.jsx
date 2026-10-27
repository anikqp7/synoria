import { getRoleUser } from "@/lib/roleSession";
import SupervisorProject from "@/components/supervisorProject";
export const metadata = { title: "Assigned Project | Synoria" };
export default async function Page({ params }) {
  await getRoleUser("supervisor");
  const { id } = await params;
  return <div className="mx-auto max-w-[1240px] px-[5%] py-10"><SupervisorProject workspaceId={id} /></div>;
}
