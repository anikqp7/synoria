import { getRoleUser } from "@/lib/roleSession";
import ProposalPeriod from "@/components/proposalPeriod";
import ProposalList from "@/components/proposalList";
export const metadata = { title: "Proposals | Synoria" };
export default async function Page({ params }) {
  await getRoleUser("department");
  
  return <div className="mx-auto max-w-[1240px] px-[5%] py-10"><h1 className="mb-8 mt-0 text-3xl font-semibold">Proposals</h1><ProposalPeriod manage /><ProposalList /></div>;
}
