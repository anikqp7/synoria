import { getRoleUser } from '@/lib/roleSession';
import SubmissionPeriod from '@/components/submissionPeriod';
import EvaluationProjects from '@/components/evaluationProjects';
export const metadata = { title: 'Evaluation | Synoria' };
export default async function Page() { await getRoleUser('examiner'); return <main className="mx-auto max-w-[1240px] px-[5%] py-10"><h1 className="mb-8 mt-0 pl-8 text-3xl font-semibold min-[761px]:pl-0">Evaluation</h1><SubmissionPeriod result/><EvaluationProjects /></main>; }
