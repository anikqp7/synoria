import { getRoleUser } from '@/lib/roleSession';
import RoleOverview from '@/components/roleOverview';
export const metadata = { title: 'Supervisor Dashboard | Synoria' };
export default async function Page() {
  const user = await getRoleUser('supervisor');
  return <RoleOverview role="supervisor" name={user.name} departmentName={user.departmentName} />;
}
