import MemberManager from "@/components/memberManager";
export const metadata = { title: "Examiners | Synoria" };
export default function ExaminersPage() {
  return <div className="mx-auto max-w-[1240px] px-[5%] py-10"><h1 className="text-3xl font-semibold">Examiners</h1><MemberManager role="examiner" /></div>;
}
