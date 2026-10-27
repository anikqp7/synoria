import { getRoleUser } from "@/lib/roleSession";
import SupervisorCapacity from "@/components/supervisorCapacity";
export const metadata = { title: "Supervisor Loads | Synoria" };
export default async function Page({ params }) {
  await getRoleUser("department");
  
  return <div className="mx-auto max-w-[1240px] px-[5%] py-10"><h1 className="mb-8 mt-0 pl-8 text-3xl font-semibold min-[761px]:pl-0">Supervisor Loads</h1><SupervisorCapacity /></div>;
}
