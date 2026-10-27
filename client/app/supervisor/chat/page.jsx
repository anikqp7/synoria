import { getRoleUser } from '@/lib/roleSession';
import ChatInbox from '@/components/chatInbox';
export const metadata = { title: 'Project Chat | Synoria' };
export default async function Page() { await getRoleUser('supervisor'); return <div className="mx-auto max-w-[1240px] px-[5%] py-10"><h1 className="mb-8 mt-0 pl-8 text-3xl min-[761px]:pl-0 font-semibold">Project Chat</h1><ChatInbox supervisor /></div>; }
