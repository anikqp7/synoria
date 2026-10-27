import { getRoleUser } from '@/lib/roleSession';
import DepartmentOverview from '@/components/departmentOverview';
export const metadata = { title: 'Coordinator Dashboard | Synoria' };
export default async function Page() {
  const department = await getRoleUser('department');
  return <DepartmentOverview departmentName={department.name} />;
}
