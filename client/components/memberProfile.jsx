import Link from "next/link";
import ResearchTags from "@/components/researchTags";

function ProfileIcon({ type, className = "size-5" }) {
  const paths = {
    email: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></>,
    phone: <path d="M7 3H4a1 1 0 0 0-1 1c0 9.4 7.6 17 17 17a1 1 0 0 0 1-1v-3l-5-2-2 2a14 14 0 0 1-7-7l2-2-2-5Z" />,
    academic: <><path d="m2 9 10-5 10 5-10 5L2 9ZM6 11v6c4 3 8 3 12 0v-6M22 9v7" /></>,
    research: <><circle cx="12" cy="12" r="3" /><ellipse cx="12" cy="12" rx="10" ry="4" /><ellipse cx="12" cy="12" rx="4" ry="10" transform="rotate(35 12 12)" /></>,
  };
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">{paths[type]}</svg>;
}

export default function MemberProfile({ profile, role, department, backHref, ownProfile = false, actions }) {
  const supervisor = role !== "student";
  const label = role.charAt(0).toUpperCase() + role.slice(1);
  const initials = profile.name.split(/\s+/).slice(0, 2).map(word => word[0]).join("").toUpperCase();
  const academicFields = [
    ...(supervisor ? [["Designation", profile.designation || label]] : [["Student ID", profile.studentId], ["Batch", profile.batch], ["Academic Session", profile.academicSession]]),
    ["Account Status", profile.isActive === false ? "Inactive" : "Active"], ["Department", department.name], ["University", department.university],
  ];
  if (profile.createdAt) academicFields.push(["Account Created", new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeZone: "Asia/Dhaka" }).format(new Date(profile.createdAt))]);

  return (
    <div className="mx-auto max-w-[1240px] px-[5%] pt-10 pb-10 max-[760px]:pt-7">
      {backHref && <Link href={backHref} className="mb-7 inline-flex items-center gap-2 text-sm text-primary hover:underline"><span aria-hidden="true">←</span> Back To {`${label}s`}</Link>}
      <div className="mb-7 flex flex-wrap items-center justify-between gap-4"><div><span className="text-[13px] font-semibold tracking-[1.5px] text-primary">{label.toUpperCase()} PROFILE</span><h1 className="mt-2 mb-0 text-[clamp(24px,2.5vw,32px)] font-semibold tracking-[-1px]">{ownProfile ? "My Profile" : `${label} Profile`}</h1></div>{actions}</div>
      <section className="overflow-hidden rounded-panel border border-border bg-surface shadow-panel" aria-label={`${label} overview`}>
        <div className="h-24 border-b border-primary-border bg-primary-soft max-[640px]:h-20" />
        <div className="px-8 pb-8 max-[640px]:px-5 max-[640px]:pb-6">
          <div className="-mt-10 mb-5 grid size-24 place-items-center rounded-panel border-4 border-surface bg-primary-soft text-3xl font-semibold text-primary max-[640px]:size-20 max-[640px]:text-2xl" aria-hidden="true">{initials}</div>
          <h2 className="m-0 text-[clamp(22px,2.3vw,30px)] font-semibold leading-snug tracking-[-.5px] [overflow-wrap:anywhere]">{profile.name}</h2>
          <p className="mt-2 mb-0 text-sm font-medium text-primary">{supervisor ? profile.designation || label : `Student ID: ${profile.studentId}`}</p>
          <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm leading-relaxed text-text-secondary"><span>{department.name}</span><span aria-hidden="true" className="text-border-strong">/</span><span>{department.university}</span></div>
        </div>
      </section>
      <div className="mt-6 grid grid-cols-[minmax(0,1fr)_minmax(0,1.7fr)] items-start gap-6 max-[900px]:grid-cols-1">
        <section className="rounded-panel border border-border bg-surface shadow-panel" aria-labelledby="profile-contact-title"><header className="border-b border-border px-6 py-5"><h2 id="profile-contact-title" className="m-0 text-lg font-semibold">Contact Information</h2></header><dl className="m-0 space-y-6 p-6">{[["Email Address", profile.email, "email"], ["Phone Number", profile.phone, "phone"]].map(([name, value, type]) => <div key={type} className="flex items-start gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-control bg-primary-soft text-primary"><ProfileIcon type={type} /></span><div className="min-w-0"><dt className="mb-1.5 text-[13px] text-text-muted">{name}</dt><dd className="m-0 text-sm leading-relaxed [overflow-wrap:anywhere]">{value ? <a className="text-primary hover:underline" href={`${type === "email" ? "mailto" : "tel"}:${value}`}>{value}</a> : "Not provided"}</dd></div></div>)}</dl></section>
        <div className="grid gap-6">
          <section className="rounded-panel border border-border bg-surface shadow-panel" aria-labelledby="profile-academic-title"><header className="flex items-center gap-3 border-b border-border px-6 py-5"><span className="text-primary"><ProfileIcon type="academic" /></span><h2 id="profile-academic-title" className="m-0 text-lg font-semibold">Academic Information</h2></header><dl className="m-0 grid grid-cols-2 gap-x-7 gap-y-6 p-6 max-[640px]:grid-cols-1">{academicFields.map(([name, value]) => <div key={name}><dt className="mb-2 text-[13px] text-text-muted">{name}</dt><dd className="m-0 text-sm leading-relaxed text-foreground [overflow-wrap:anywhere]">{value || "Not provided"}</dd></div>)}</dl></section>
          {role === "supervisor" && <section className="rounded-panel border border-border bg-surface shadow-panel" aria-labelledby="profile-research-title"><header className="flex items-center gap-3 border-b border-border px-6 py-5"><span className="text-primary"><ProfileIcon type="research" /></span><h2 id="profile-research-title" className="m-0 text-lg font-semibold">Research Interests</h2></header><div className="p-6">{profile.researchInterests ? <ResearchTags value={profile.researchInterests} /> : <p className="m-0 text-sm text-text-muted">No research interests added yet.</p>}</div></section>}
        </div>
      </div>
    </div>
  );
}
