"use client";
import Link from 'next/link';
import { useEffect, useState } from 'react';
import Button from '@/components/button';

const panel = 'overflow-hidden rounded-panel border border-border bg-surface';
const textLink = 'text-sm font-semibold text-primary hover:underline';
const titles = { student: 'Student Dashboard', supervisor: 'Supervisor Dashboard', examiner: 'Examiner Dashboard' };
const date = value => new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'Asia/Dhaka' }).format(new Date(value));
const clock = value => new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Dhaka' }).format(new Date(value));
function Panel({ title, href, action, children }) {
  return <section className={panel}><header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4"><h2 className="m-0 text-base font-semibold">{title}</h2>{href && <Link href={href} className={textLink}>{action}</Link>}</header>{children}</section>;
}
export default function RoleOverview({ role, name, departmentName }) {
  const [data, setData] = useState(null), [error, setError] = useState(''), [loading, setLoading] = useState(true), [tick, setTick] = useState(0);
  useEffect(() => {
    let active = true, running = false;
    const controller = new AbortController();
    async function load() {
      if (running) return;
      running = true;
      try {
        const paths = role === 'student' ? ['/api/workspaces', '/api/defenceNotices'] : role === 'supervisor' ? ['/api/supervision', '/api/chat', '/api/defenceNotices'] : ['/api/evaluationProjects', '/api/defenceNotices'];
        const results = await Promise.all(paths.map(async path => {
          const response = await fetch(path, { cache: 'no-store', signal: controller.signal });
          const result = await response.json();
          if (!response.ok) throw new Error(result.message || 'Unable to load your dashboard.');
          return result;
        }));
        if (active) { setData({ primary: results[0], chats: role === 'supervisor' ? results[1] : null, notices: results.at(-1).notices, updatedAt: new Date().toISOString() }); setError(''); }
      } catch (err) { if (active && err.name !== 'AbortError') setError(err.message); }
      finally { running = false; if (active) setLoading(false); }
    }
    load();
    const refresh = () => { if (document.visibilityState === 'visible') load(); };
    const timer = setInterval(refresh, 30000);
    window.addEventListener('focus', refresh);
    return () => { active = false; controller.abort(); clearInterval(timer); window.removeEventListener('focus', refresh); };
  }, [role, tick]);
  const workspace = data?.primary.workspace;
  const projects = role === 'supervisor' ? data?.primary.proposals || [] : (data?.primary.projects || []).filter(item => item.defenceId);
  const pending = projects.filter(item => role === 'supervisor' ? ['submitted', 'revisionRequested'].includes(item.proposalStatus) : ['notStarted', 'draft'].includes(item.evaluationStatus));
  const next = data?.notices?.[0];
  const stats = role === 'supervisor' ? [['Assigned Projects', projects.length, 'projects'], ['Awaiting Review', pending.length, 'proposals'], ['Unread Messages', data?.chats?.totalUnread || 0, 'chat'], ['Upcoming Defences', data?.notices?.length || 0, 'defences']] : [['Assigned Evaluations', projects.length, 'results'], ['Pending Evaluations', pending.length, 'results'], ['Submitted Evaluations', projects.filter(item => ['submitted', 'published'].includes(item.evaluationStatus)).length, 'results'], ['Upcoming Defences', data?.notices?.length || 0, 'defences']];
  return <main className="mx-auto max-w-[1280px] space-y-6 px-[5%] py-8 lg:py-9">
    <header className="flex flex-wrap items-center justify-between gap-4 pl-8 min-[761px]:pl-0"><div className="min-w-0"><h1 className="m-0 text-[clamp(24px,2.4vw,30px)] font-semibold leading-tight tracking-tight">{titles[role]}</h1><p className="mb-0 mt-2 text-sm text-text-secondary [overflow-wrap:anywhere]">{departmentName}</p></div><Button appearance="outline" size="small" disabled={loading} onClick={() => { setLoading(true); setTick(value => value + 1); }}>{loading && data ? 'Refreshing…' : 'Refresh'}</Button></header>
    {error && <p role="alert" className="rounded-control border border-danger-border bg-danger-soft p-4 text-sm text-danger">{error}{data && ' Showing the last available update.'}</p>}
    {!data && !error && <div role="status" className="h-28 animate-pulse rounded-panel border border-border bg-surface motion-reduce:animate-none"><span className="sr-only">Loading dashboard…</span></div>}
    {data && <>
      {role === 'student' ? <section className="rounded-panel border border-primary-border bg-primary-soft p-5 sm:p-6"><p className="m-0 text-sm font-medium text-primary">Your Academic Workspace</p><h2 className="mb-0 mt-2 text-2xl font-semibold [overflow-wrap:anywhere]">Welcome, {name}.</h2><p className="mb-0 mt-2 text-sm text-text-secondary">Your team and project, in one place.</p></section> : <section aria-label="Dashboard summary" className="grid grid-cols-2 overflow-hidden rounded-panel border border-border bg-surface lg:grid-cols-4">{stats.map(([label, count, path], index) => <Link key={label} href={`/${role}/${path}`} className={`min-w-0 p-5 transition-colors hover:bg-surface-hover focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary ${index % 2 === 0 ? 'border-r border-border' : ''} ${index < 2 ? 'border-b border-border lg:border-b-0' : ''} ${index === 1 ? 'lg:border-r lg:border-border' : ''}`}><p className="m-0 min-h-12 text-sm leading-relaxed text-text-secondary lg:min-h-0">{label}</p><p className="mb-0 mt-2 text-3xl font-semibold leading-none tabular-nums">{count}</p></Link>)}</section>}
      {role === 'student' ? <Panel title="Project" href="/student/team" action={workspace ? 'Manage Team' : 'View Team'}><div className="p-5 sm:p-6"><h3 className="m-0 text-lg font-semibold [overflow-wrap:anywhere]">{workspace?.name || data.primary.projectLimit?.projectName || 'Your Team Starts Here'}</h3><p className="mb-0 mt-2 text-sm text-text-secondary">{workspace ? `${workspace.members.length} Team Members · ${workspace.workType === 'thesis' ? 'Thesis' : workspace.workType === 'research' ? 'Research' : 'Final Year Project'}` : data.primary.projectLimit ? 'Your project is already registered. Open Team to view its availability.' : 'Create a team or accept an invitation to get started.'}</p>{workspace && <><ul className="mb-0 mt-5 flex list-none flex-wrap gap-2 p-0">{workspace.members.map(member => <li key={member.id} className="rounded-control border border-border px-3 py-1.5 text-sm [overflow-wrap:anywhere]">{member.name}</li>)}</ul><div className="mt-5 flex flex-wrap gap-4 border-t border-border pt-4"><Link href="/student/proposal" className={textLink}>View Proposal</Link><Link href="/student/resources" className={textLink}>Project Resources</Link><Link href="/student/chat" className={textLink}>Open Chat</Link></div></>}</div></Panel> : <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]"><Panel title={role === 'supervisor' ? 'Needs Attention' : 'Pending Evaluations'} href={`/${role}/${role === 'supervisor' ? 'proposals' : 'results'}`} action={role === 'supervisor' ? 'View Proposals' : 'View Evaluations'}>{pending.length ? <ul className="m-0 list-none divide-y divide-border px-5">{pending.slice(0, 5).map(item => <li key={item.workspaceId || item.id} className="flex flex-wrap items-center justify-between gap-3 py-4"><div className="min-w-0 flex-1 basis-44"><p className="m-0 text-sm font-semibold [overflow-wrap:anywhere]">{item.title}</p><p className="mb-0 mt-1 text-sm text-text-secondary [overflow-wrap:anywhere]">{item.workspaceName || item.name}</p></div><Link href={role === 'supervisor' ? `/supervisor/proposals/${item.workspaceId}` : `/examiner/defences/${item.defenceId}`} className={textLink}>{role === 'supervisor' ? 'View Proposal' : 'Open Evaluation'}</Link></li>)}</ul> : <p className="m-0 px-5 py-9 text-center text-sm text-text-secondary">{role === 'supervisor' ? 'No proposals awaiting your review.' : 'No pending evaluations.'}</p>}</Panel><div className="space-y-5"><Panel title="Next Defence" href={`/${role}/defences`} action="View Schedule">{next ? <div className="flex items-start gap-4 p-5"><div className="shrink-0 rounded-control border border-primary-border bg-primary-soft p-3 text-sm font-semibold text-primary">{date(next.startsAt)}</div><div className="min-w-0"><p className="m-0 text-sm font-semibold [overflow-wrap:anywhere]">Batch {next.batch} · {next.stream}</p><p className="mb-0 mt-1 text-sm text-text-secondary [overflow-wrap:anywhere]">{clock(next.startsAt)} · {next.venue}</p></div></div> : <p className="m-0 p-5 text-sm text-text-secondary">No upcoming defence dates.</p>}</Panel><Panel title={role === 'supervisor' ? 'Assigned Projects' : 'Evaluation Progress'} href={`/${role}/${role === 'supervisor' ? 'projects' : 'results'}`} action="View All"><p className="m-0 p-5 text-sm leading-relaxed text-text-secondary">{role === 'supervisor' ? `${projects.length} assigned projects. Open a project to view its team, resources and chat.` : `${projects.filter(item => ['submitted', 'published'].includes(item.evaluationStatus)).length} of ${projects.length} assigned evaluations submitted.`}</p></Panel></div></div>}
      <p className="m-0 text-right text-sm text-text-muted">Last updated {clock(data.updatedAt)}</p>
    </>}
  </main>;
}
