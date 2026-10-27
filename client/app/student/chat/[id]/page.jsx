import { getRoleUser } from '@/lib/roleSession';
import ProjectChat from '@/components/projectChat';
export const metadata = { title: 'Private Project Chat | Synoria' };
export default async function Page({ params }) { await getRoleUser('student'); const { id } = await params; return <div className="flex h-full min-h-0 flex-col"><ProjectChat key={id} workspaceId={id}  /></div>; }
