import { getRoleUser } from "@/lib/roleSession";
import ProposalList from "@/components/proposalList";
export const metadata = { title: "Assigned Projects | Synoria" };
export default async function Page({ params }) {
  await getRoleUser("supervisor");
  
  return <div className="mx-auto max-w-[1240px] px-[5%] py-10"><h1 className="mb-8 mt-0 pl-8 text-3xl min-[761px]:pl-0 font-semibold">Assigned Projects</h1><ProposalList supervisor /></div>;
}
