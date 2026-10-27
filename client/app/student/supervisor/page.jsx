import { getRoleUser } from '@/lib/roleSession';
import SupervisorRequests from '@/components/supervisorRequests';
export const metadata = { title: 'Supervisor | Synoria' };
export default async function Page() {
  await getRoleUser('student');
  return <main className="mx-auto max-w-[1240px] px-[5%] py-9"><h1 className="mb-7 mt-0 pl-8 text-3xl font-semibold min-[761px]:pl-0">Supervisor</h1><SupervisorRequests /></main>;
}
