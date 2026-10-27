import {getRoleUser} from "@/lib/roleSession";
import TeamManager from "@/components/teamManager";
export const metadata={title:"Team | Synoria"};
export default async function Page({params}){const user=await getRoleUser("student");const {id}=await params;return <main className="mx-auto max-w-[1240px] px-[5%] py-10"><h1 className="mb-8 mt-0 pl-8 text-3xl font-semibold min-[761px]:pl-0">Team</h1><TeamManager userId={user.id} teamId={id}/></main>;}
