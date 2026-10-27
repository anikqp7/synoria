import { getRoleUser } from '@/lib/roleSession';
import StudentChatEntry from '@/components/studentChatEntry';
export const metadata = { title: 'Project Chat | Synoria' };
export default async function Page() { await getRoleUser('student'); return <StudentChatEntry />; }
