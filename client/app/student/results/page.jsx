import { getRoleUser } from '@/lib/roleSession';
import CurrentResult from '@/components/currentResult';
export const metadata = { title: 'Results | Synoria' };
export default async function Page() { await getRoleUser('student'); return <main className="mx-auto max-w-[1240px] px-[5%] py-10"><h1 className="mb-8 mt-0 pl-8 text-3xl font-semibold min-[761px]:pl-0">Results</h1><CurrentResult role="student" /></main>; }
