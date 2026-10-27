import StudentManager from "@/components/studentManager";

export const metadata = { title: "Students | Synoria" };

export default function StudentsPage() {
  return <div className="mx-auto max-w-[1240px] px-[5%] pt-[45px] pb-8 max-[760px]:pt-7"><div className="mb-8"><span className="text-[13px] font-bold tracking-[2px] text-primary">YOUR ACADEMIC WORKSPACE</span><h1 className="mt-3 mb-0 text-[clamp(24px,2.5vw,32px)] font-semibold tracking-[-1px]">Students</h1></div><StudentManager /></div>;
}
