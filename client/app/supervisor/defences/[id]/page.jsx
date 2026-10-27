import { getRoleUser } from '@/lib/roleSession';
import DefenceDetail from '@/components/defenceDetail';
export const metadata = { title: 'Defence Details | Synoria' };
export default async function Page({ params }) { await getRoleUser('supervisor'); const { id } = await params; return <main className="mx-auto max-w-[1240px] px-[5%] py-10"><DefenceDetail key={id} role="supervisor" defenceId={id} /></main>; }
