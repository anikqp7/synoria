import { getRoleUser } from '@/lib/roleSession';
import DefenceNoticeBoard from '@/components/defenceNoticeBoard';
export const metadata = { title: 'Defence Schedules | Synoria' };
export default async function Page() { await getRoleUser('department'); return <main className="mx-auto max-w-[1240px] px-[5%] py-10"><h1 className="mb-8 mt-0 pl-8 text-3xl font-semibold min-[761px]:pl-0">Defence Schedules</h1><DefenceNoticeBoard role="department" /></main>; }
