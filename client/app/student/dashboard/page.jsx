import { getRoleUser } from '@/lib/roleSession';
import RoleOverview from '@/components/roleOverview';
export const metadata = { title: 'Student Dashboard | Synoria' };
export default async function Page() {
  const user = await getRoleUser('student');
  return <RoleOverview role="student" name={user.name} departmentName={user.departmentName} />;
}
