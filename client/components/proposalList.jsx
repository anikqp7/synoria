"use client";
import { Input } from '@/components/validatedForm';
import useInitialLoad from "@/lib/useInitialLoad";
import Link from 'next/link';
import { useCallback, useState } from 'react';
import Button from '@/components/button';
import { proposalStatusLabels } from '@/components/proposalHistory';
import { proposalDate } from '@/components/proposalDetails';
function AssignedProjects({proposals,filtered,loading,error,search,onSearch,onRefresh}) {
 const action='inline-flex min-h-10 items-center justify-center gap-2 rounded-control px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';
 return <div className="space-y-5">
   <section aria-label="Project filters" className="rounded-panel border border-border bg-surface p-5">
     <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><p className="m-0 text-sm text-text-secondary"><span className="font-semibold text-foreground">{proposals.length}</span> Assigned Projects</p><Button onClick={onRefresh} appearance="outline" size="small" disabled={loading}>Refresh List</Button></div>
     <div><label htmlFor="proposalSearch" className="mt-0">Search Projects</label><Input id="proposalSearch" type="search" value={search} onChange={event=>onSearch(event.target.value)} placeholder="Project title, team or research area"/></div>
   </section>
   {error&&<p role="alert" className="rounded-control border border-danger-border bg-danger-soft p-4 text-sm text-danger">{error}</p>}
   {loading?<p role="status" className="text-sm text-text-muted">Loading assigned projects…</p>:!error&&filtered.length?<ul aria-label="Assigned projects" className="m-0 grid list-none gap-5 p-0 lg:grid-cols-2">{filtered.map(item=><li key={item.workspaceId} className="flex min-w-0 flex-col overflow-hidden rounded-panel border border-border bg-surface">
     <article className="flex-1 p-5 sm:p-6"><div className="flex flex-wrap items-start justify-between gap-3"><Link href={`/supervisor/projects/${item.workspaceId}`} className="min-w-0 flex-1 basis-52 text-lg font-semibold leading-relaxed text-foreground hover:text-primary [overflow-wrap:anywhere]">{item.title}</Link></div>
       <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-text-secondary"><span className="inline-flex min-w-0 items-center gap-2 [overflow-wrap:anywhere]"><svg aria-hidden="true" className="size-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><circle cx="9" cy="7" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3M16 4a3 3 0 0 1 0 6M21 21v-3a6 6 0 0 0-4-5"/></svg>{item.workspaceName}</span><span>· {item.memberCount} {item.memberCount===1?'Member':'Members'}</span>{item.status==='archived'&&<span className="rounded-control bg-surface-soft px-2 py-1 text-[13px]">Completed</span>}</div>
       {item.researchArea&&<p className="mb-0 mt-4 inline-block max-w-full rounded-control bg-primary-soft px-3 py-1 text-sm text-primary [overflow-wrap:anywhere]">{item.researchArea}</p>}
     </article>
     <footer className="mt-auto flex flex-wrap gap-2 border-t border-border p-4 sm:px-5"><Link href={`/supervisor/projects/${item.workspaceId}`} className={`${action} bg-primary text-white hover:bg-primary-active`}>View Project</Link><Link href={`/supervisor/resources/${item.workspaceId}`} className={`${action} border border-border text-text-secondary hover:bg-surface-hover`}>Project Resources</Link><Link href={`/supervisor/chat/${item.workspaceId}`} className={`${action} text-primary hover:bg-primary-soft`}>Open Chat</Link></footer>
   </li>)}</ul>:!error&&<section className="rounded-panel border border-dashed border-border bg-surface px-6 py-10 text-center"><h2 className="m-0 text-base font-semibold">{proposals.length?'No Matching Projects':'No Assigned Projects Yet'}</h2><p className="mb-0 mt-2 text-sm text-text-secondary">{proposals.length?'Try another project title, team or research area.':'Projects assigned by your department will appear here.'}</p></section>}
 </div>;
}
export default function ProposalList({ supervisor = false, review = false }) {
  const [proposals, setProposals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const response = await fetch(supervisor ? '/api/supervision' : '/api/proposals', { cache: 'no-store' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);
      setProposals(result.proposals);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }, [supervisor]);
  useInitialLoad(load);
  const visible = supervisor && review ? proposals.filter(item => item.proposalStatus !== 'draft') : proposals;
  const filtered = visible.filter(item => `${item.title} ${item.workspaceName} ${item.researchArea}`.toLowerCase().includes(search.toLowerCase()));
  if(supervisor&&!review)return <AssignedProjects proposals={proposals} filtered={filtered} loading={loading} error={error} search={search} onSearch={setSearch} onRefresh={load}/>;
  const action='inline-flex min-h-10 items-center justify-center rounded-control px-4 py-2 text-sm font-semibold';
  return <div className="space-y-5"><section className="rounded-panel border border-border bg-surface p-5"><div className="mb-5 flex flex-wrap items-center justify-between gap-3"><p className="m-0 text-sm text-text-secondary"><span className="font-semibold text-foreground">{visible.length}</span> {supervisor?'Proposals':'Submitted Proposals'}</p><Button onClick={load} appearance="outline" size="small" disabled={loading}>Refresh List</Button></div><label htmlFor="proposalSearch" className="mt-0">Search Proposals</label><Input id="proposalSearch" type="search" value={search} onChange={event=>setSearch(event.target.value)} placeholder="Title, team or research area"/></section>
    {loading?<p role="status" className="text-sm text-text-muted">Loading proposals…</p>:error?<p role="alert" className="text-sm text-text-secondary">{error}</p>:filtered.length?<ul aria-label="Proposals" className="m-0 grid list-none gap-5 p-0 lg:grid-cols-2">{filtered.map(item=><li key={item.workspaceId} className="flex min-w-0 flex-col overflow-hidden rounded-panel border border-border bg-surface"><article className="flex-1 p-5 sm:p-6"><Link className="text-lg font-semibold leading-relaxed text-foreground hover:text-primary [overflow-wrap:anywhere]" href={supervisor?`/supervisor/proposals/${item.workspaceId}`:`/department/proposals/${item.workspaceId}`}>{item.title}</Link><p className="mb-0 mt-3 text-sm text-text-secondary [overflow-wrap:anywhere]">{item.workspaceName} · {item.memberCount} {item.memberCount===1?'Member':'Members'}</p><div className="mt-4 flex flex-wrap gap-2"><span className="rounded-control border border-primary-border bg-primary-soft px-2.5 py-1 text-sm font-medium text-primary">{proposalStatusLabels[item.proposalStatus]||'Pending Review'}</span>{item.researchArea&&<span className="max-w-full rounded-control bg-surface-soft px-2.5 py-1 text-sm text-text-secondary [overflow-wrap:anywhere]">{item.researchArea}</span>}</div>{!supervisor&&<p className="mb-0 mt-4 text-sm text-text-secondary [overflow-wrap:anywhere]">Preferred Supervisor: {item.supervisorPreference?.name||'Not selected'}</p>}</article><footer className="mt-auto border-t border-border px-5 py-4"><p className="mb-3 mt-0 text-sm text-text-muted">Submitted {proposalDate(item.submittedAt)}</p><div className="flex flex-wrap gap-2"><Link href={supervisor?`/supervisor/proposals/${item.workspaceId}`:`/department/proposals/${item.workspaceId}`} className={`${action} bg-primary text-white hover:bg-primary-active`}>{supervisor?'Review Proposal':'View Proposal'}</Link>{supervisor&&<Link href={`/supervisor/chat/${item.workspaceId}`} className={`${action} border border-border text-text-secondary hover:bg-surface-hover`}>Open Chat</Link>}</div></footer></li>)}</ul>:<section className="rounded-panel border border-dashed border-border bg-surface p-6"><p className="m-0 text-sm text-text-muted">{proposals.length?'No proposals match your search.':supervisor?'Assigned team proposals will appear here.':'Submitted team proposals will appear here. Student drafts remain private to their teams.'}</p></section>}
  </div>;
}
