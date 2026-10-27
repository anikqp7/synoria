import {getRoleUser} from "@/lib/roleSession";
import ProposalManager from "@/components/proposalManager";
export const metadata={title:"Proposal Review | Synoria"};
export default async function Page({params}){await getRoleUser("supervisor");const {id}=await params;return <main className="mx-auto max-w-[1240px] px-[5%] py-10"><h1 className="mb-8 mt-0 pl-8 text-3xl font-semibold min-[761px]:pl-0">Proposal Review</h1><ProposalManager supervisor workspaceId={id}/></main>;}
