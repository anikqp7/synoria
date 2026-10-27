import { getRoleUser } from "@/lib/roleSession";
import ProposalManager from "@/components/proposalManager";
export const metadata = { title: "Proposal Details | Synoria" };
export default async function Page({ params }) {
  await getRoleUser("department");
  const { id } = await params;
  return <div className="mx-auto max-w-[1240px] px-[5%] py-10"><h1 className="mb-8 mt-0 text-3xl font-semibold">Proposal Details</h1><ProposalManager coordinator workspaceId={id} /></div>;
}
