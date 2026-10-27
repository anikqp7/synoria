import { getRoleUser } from '@/lib/roleSession';
import RoleOverview from '@/components/roleOverview';
export const metadata = { title: 'Examiner Dashboard | Synoria' };
export default async function Page() {
  const user = await getRoleUser('examiner');
  return <RoleOverview role="examiner" name={user.name} departmentName={user.departmentName} />;
}
