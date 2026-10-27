"use client";
import { Input } from '@/components/validatedForm';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import Button from '@/components/button';
import { labelFor } from '@/lib/monitoringFormat';
const evaluationLabels = { unassigned: 'Not Assigned For Evaluation', notStarted: 'Evaluation Pending', draft: 'Evaluation Draft', submitted: 'Evaluation Submitted', published: 'Result Published' };
export default function EvaluationProjects() {
  const [data, setData] = useState(null), [error, setError] = useState(''), [loading, setLoading] = useState(true), [search, setSearch] = useState(''), [tick, setTick] = useState(0);
  useEffect(() => {
    let current = true, running = false; const controller = new AbortController();
    async function load() {
      if (running) return; running = true;
      try { const response = await fetch('/api/evaluationProjects', { cache: 'no-store', signal: controller.signal }); const result = await response.json(); if (!response.ok) throw new Error(result.message || 'Unable to load projects.'); if (current) { setData(result); setError(''); } }
      catch (error) { if (current && error.name !== 'AbortError') setError(error.message); }
      finally { running = false; if (current) setLoading(false); }
    }
    load(); const refresh = () => { if (document.visibilityState === 'visible') load(); }; const timer = setInterval(refresh, 30000); window.addEventListener('focus', refresh);
    return () => { current = false; controller.abort(); clearInterval(timer); window.removeEventListener('focus', refresh); };
  }, [tick]);
  const query = search.trim().toLowerCase();
  const projects = (data?.projects || []).filter(item => [item.name,item.title,item.researchArea,item.supervisorName].some(value => value?.toLowerCase().includes(query)));
  return <section className="overflow-hidden rounded-panel border border-border bg-surface">
    <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border p-5 sm:p-6"><div><h2 className="m-0 text-lg font-semibold">Assigned Projects</h2><p className="mb-0 mt-2 text-sm text-text-secondary">Projects submitted to you for evaluation.</p></div><Button appearance="outline" size="small" disabled={loading} onClick={() => { setLoading(true); setTick(value => value + 1); }}>Refresh Projects</Button></header>
    <div className="border-b border-border px-5 py-4 sm:px-6"><label htmlFor="evaluationProjectSearch" className="sr-only">Search Projects</label><Input id="evaluationProjectSearch" type="search" maxLength={200} value={search} onChange={event => setSearch(event.target.value)} placeholder="Search project, research area or supervisor" /></div>
    {error && <p role="alert" className="px-6 text-sm text-danger">{error}</p>}
    {!data && !error && <p role="status" className="p-6 text-sm text-text-muted">Loading projects…</p>}
    {data && <ul className="m-0 list-none divide-y divide-border p-0">{projects.map(project => <li key={project.id} className="p-5 sm:p-6"><div className="flex flex-wrap items-start justify-between gap-4"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-3"><h3 className="m-0 text-base font-semibold [overflow-wrap:anywhere]">{project.title}</h3><span className="rounded-control bg-primary-soft px-2.5 py-1 text-[13px] font-medium text-primary">{labelFor(project.status)}</span></div>{project.name !== project.title && <p className="mb-0 mt-2 text-sm text-text-secondary">{project.name}</p>}<p className="mb-0 mt-3 text-sm text-text-secondary">{labelFor(project.workType)} · {project.memberCount} Member{project.memberCount === 1 ? '' : 's'} · Supervisor: {project.supervisorName || 'Unassigned'}</p>{project.researchArea && <p className="mb-0 mt-2 text-[13px] text-text-muted">{project.researchArea}</p>}</div><div className="flex shrink-0 flex-col items-start gap-3 sm:items-end"><span className="text-[13px] text-text-muted">{evaluationLabels[project.evaluationStatus]}</span>{project.defenceId && <Link href={`/examiner/defences/${project.defenceId}`} className="rounded-control border border-primary-border px-3 py-2 text-sm font-semibold text-primary hover:bg-primary-soft">{project.evaluationStatus === 'published' ? 'View Evaluation' : 'Open Evaluation'}</Link>}</div></div></li>)}</ul>}
    {data && !projects.length && <p role="status" className="p-6 text-center text-sm text-text-muted">{query ? 'No Projects Match Your Search' : 'No Projects Assigned For Evaluation'}</p>}
  </section>;
}
