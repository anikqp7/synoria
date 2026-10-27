import ProjectResources from "@/components/projectResources";
export const metadata = { title: "Project Resources | Synoria" };
export default async function Page({params}) {
 const {id}=await params;
 return <section className="mx-auto max-w-[1240px] px-[5%] py-9"><h1 className="mb-7 mt-0 pl-8 text-2xl font-semibold min-[761px]:pl-0">Project Resources</h1><ProjectResources role="supervisor" projectId={id} /></section>;
}
