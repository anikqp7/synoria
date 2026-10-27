import { getRoleUser } from '@/lib/roleSession';
import SubmissionPeriod from '@/components/submissionPeriod';
export const metadata = { title: 'Supervisor Choice Notice | Synoria' };
export default async function Page() {
  await getRoleUser('supervisor');
  return <main className="mx-auto max-w-[1240px] px-[5%] py-9"><h1 className="mb-7 mt-0 pl-8 text-3xl font-semibold min-[761px]:pl-0">Supervisor Choice Notice</h1><SubmissionPeriod supervisor /></main>;
}
