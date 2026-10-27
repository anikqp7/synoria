import {getRoleUser} from "@/lib/roleSession";
import ProposalPeriod from "@/components/proposalPeriod";
export const metadata={title:"Proposal Notice | Synoria"};
export default async function Page(){await getRoleUser("examiner");return <main className="mx-auto max-w-[1240px] px-[5%] py-10"><h1 className="mb-8 mt-0 pl-8 text-3xl font-semibold min-[761px]:pl-0">Proposal Notice</h1><ProposalPeriod/></main>;}
