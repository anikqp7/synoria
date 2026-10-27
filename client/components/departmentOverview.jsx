"use client";
import Link from 'next/link';
import { useEffect, useState } from 'react';
import Button from '@/components/button';

function Icon({ name, className = 'size-5' }) {
  const paths = {
    projects: <><path d="M3 7V5a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" /><path d="M3 10h18" /></>,
    assignment: <><circle cx="9" cy="7" r="3" /><path d="M3 21v-3a6 6 0 0 1 12 0v3M19 8v8M15 12h8" /></>,
    active: <><path d="m3 12 5 5L21 4M3 21h18" /></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M7 3v4M17 3v4M3 11h18M8 15h3M8 18h6" /></>,
    arrow: <path d="M4 12h16m-5-5 5 5-5 5" />,
    check: <><circle cx="12" cy="12" r="9" /><path d="m8 12 3 3 5-6" /></>,
  };
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={className}>{paths[name]}</svg>;
}
const shortDate = value => new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'Asia/Dhaka' }).format(new Date(value));
const clock = value => new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Dhaka' }).format(new Date(value));
const panel = 'overflow-hidden rounded-panel border border-border bg-surface';
const textLink = 'inline-flex items-center gap-1.5 rounded-control text-sm font-semibold text-primary hover:underline';

export default function DepartmentOverview({ departmentName }) {
  const [data, setData] = useState(null), [error, setError] = useState(''), [loading, setLoading] = useState(true), [tick, setTick] = useState(0);
  useEffect(() => {
    let current = true, running = false;
    const controller = new AbortController();
    async function load() {
      if (running) return; running = true;
      try {
        const response = await fetch('/api/monitoring/overview', { cache: 'no-store', signal: controller.signal });
        const result = await response.json();
        if (!response.ok) throw new Error(result.message || 'Unable to load your dashboard.');
        if (current) { setData(result); setError(''); }
      } catch (error) { if (current && error.name !== 'AbortError') setError(error.message); }
      finally { running = false; if (current) setLoading(false); }
    }
    load(); const refresh = () => { if (document.visibilityState === 'visible') load(); };
    const timer = setInterval(refresh, 30000); window.addEventListener('focus', refresh);
    return () => { current = false; controller.abort(); clearInterval(timer); window.removeEventListener('focus', refresh); };
  }, [tick]);
  const cards = data ? [
    { title: 'Total Projects', value: data.summary.total, detail: 'Projects & theses', icon: 'projects', href: '/department/resources' },
    { title: 'Awaiting Assignment', value: data.summary.awaitingAssignment, detail: 'Need a supervisor', icon: 'assignment', href: '/department/proposals' },
    { title: 'Active Projects', value: data.summary.active, detail: 'Approved & in supervision', icon: 'active', href: '/department/proposals' },
    { title: 'Upcoming Defences', value: data.summary.upcoming, detail: 'Scheduled ahead', icon: 'calendar', href: '/department/defences' },
  ] : [];
  const nextDefence = data?.upcoming[0];
  return <div className="mx-auto max-w-[1280px] space-y-6 px-[5%] py-8 lg:py-9">
    <header className="flex flex-wrap items-center justify-between gap-4 pl-8 min-[761px]:pl-0">
      <div className="min-w-0"><h1 className="m-0 text-[clamp(24px,2.4vw,30px)] font-semibold leading-tight tracking-tight">Coordinator Dashboard</h1><p className="mb-0 mt-2 text-sm text-text-secondary [overflow-wrap:anywhere]">{departmentName}</p></div>
      <Button appearance="outline" size="small" disabled={loading} onClick={() => { setLoading(true); setTick(value => value + 1); }}>{loading && data ? 'Refreshing…' : 'Refresh'}</Button>
    </header>
    {error && <p role="alert" className="rounded-control border border-danger-border bg-danger-soft p-4 text-sm text-danger">{error}{data && ' Showing the last available update.'}</p>}
    {!data && !error && <div role="status" className="grid grid-cols-2 gap-3 lg:grid-cols-4"><span className="sr-only">Loading dashboard…</span>{[0,1,2,3].map(item => <div key={item} className="h-28 animate-pulse rounded-panel border border-border bg-surface motion-reduce:animate-none" />)}</div>}
    {data && <>
      <section aria-label="Department summary" className="grid grid-cols-2 overflow-hidden rounded-panel border border-border bg-surface lg:grid-cols-4">{cards.map((card,index) => <Link key={card.title} href={card.href} className={`group flex min-w-0 items-center justify-between gap-3 p-5 transition-colors hover:bg-surface-hover focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary ${index % 2 === 0 ? 'border-r border-border' : ''} ${index < 2 ? 'border-b border-border lg:border-b-0' : ''} ${index === 1 ? 'lg:border-r lg:border-border' : ''}`}><div className="min-w-0"><p className="m-0 min-h-12 text-sm leading-relaxed text-text-secondary lg:min-h-0">{card.title}</p><p className="mb-0 mt-2 text-3xl font-semibold leading-none tabular-nums">{card.value}</p></div><Icon name={card.icon} className="hidden size-5 shrink-0 text-primary sm:block" /></Link>)}</section>
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
        <section className={panel} aria-labelledby="attentionHeading">
          <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4"><div className="flex items-center gap-2"><h2 id="attentionHeading" className="m-0 text-base font-semibold">Needs Attention</h2>{data.attentionCount > 0 && <span className="rounded-control bg-primary-soft px-2 py-0.5 text-sm font-medium text-primary">{data.attentionCount}</span>}</div><Link href="/department/proposals" className={textLink}>View Proposals</Link></header>
          {data.attention.length ? <ul className="m-0 list-none divide-y divide-border px-5">{data.attention.map(item => <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-4"><div className="min-w-0 flex-1 basis-44"><p className="m-0 text-sm font-semibold [overflow-wrap:anywhere]">{item.name}</p><p className="mb-0 mt-1 flex items-start gap-2 text-sm leading-relaxed text-text-secondary"><span aria-hidden="true" className={`mt-2 size-1.5 shrink-0 rounded-full ${item.priority === 0 ? 'bg-warning' : item.priority === 1 ? 'bg-danger' : 'bg-primary'}`} />{item.reason}</p></div><Link href={item.href} className="inline-flex shrink-0 items-center gap-2 rounded-control px-2 py-2 text-sm font-medium text-primary hover:bg-primary-soft">{item.action}<Icon name="arrow" className="size-3.5" /></Link></li>)}</ul> : <div className="px-5 py-9 text-center"><Icon name="check" className="mx-auto mb-3 size-7 text-success" /><p className="m-0 text-sm font-medium">Nothing Needs Your Attention</p><p className="mb-0 mt-2 text-sm text-text-muted">No pending proposal or supervisor assignments.</p></div>}
          {data.attentionCount > data.attention.length && <p className="m-0 border-t border-border px-5 py-3 text-sm text-text-muted">Showing {data.attention.length} of {data.attentionCount} items.</p>}
        </section>
        <div className="space-y-5">
          <section className={panel} aria-labelledby="upcomingHeading"><header className="flex items-center justify-between gap-3 border-b border-border px-5 py-4"><h2 id="upcomingHeading" className="m-0 text-base font-semibold">Next Defence</h2><Link href="/department/defences" className={textLink}>View Schedule</Link></header>
            {nextDefence ? <Link href={`/department/defences#notice-${nextDefence.id}`} className="flex items-start gap-4 p-5 transition-colors hover:bg-surface-hover"><div className="flex min-w-14 shrink-0 flex-col items-center rounded-control border border-primary-border bg-primary-soft p-2 text-primary"><span className="text-xl font-semibold leading-none">{shortDate(nextDefence.startsAt).split(' ')[0]}</span><span className="mt-1 text-sm">{shortDate(nextDefence.startsAt).split(' ')[1]}</span></div><div className="min-w-0"><p className="m-0 text-sm font-semibold [overflow-wrap:anywhere]">Batch {nextDefence.batch} · {nextDefence.stream}</p><p className="mb-0 mt-1 text-sm text-text-secondary [overflow-wrap:anywhere]">{clock(nextDefence.startsAt)} · {nextDefence.venue}</p></div></Link> : <div className="p-5"><p className="m-0 text-sm text-text-secondary">No upcoming defence dates.</p><Link href="/department/defences" className={`${textLink} mt-3`}>Publish Defence Notice</Link></div>}
          </section>
          <section className={panel} aria-labelledby="capacityHeading"><header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4"><h2 id="capacityHeading" className="m-0 text-base font-semibold">Supervisor Capacity</h2><Link href="/department/supervisorLoads" className={textLink}>Manage</Link></header>
            <div className="p-5"><p className="mb-4 mt-0 text-sm text-text-secondary"><span className="font-semibold text-foreground">{data.availablePlaces}</span> places available · {data.supervisorCount} supervisors</p><ul className="m-0 list-none space-y-4 p-0">{data.supervisors.map(item => <li key={item.id}><div className="flex items-start justify-between gap-3"><Link href={`/department/supervisors/${item.id}`} className="min-w-0 text-sm font-medium hover:text-primary [overflow-wrap:anywhere]">{item.name}</Link><span className="shrink-0 text-sm tabular-nums text-text-secondary">{item.currentLoad} / {item.maxLoad}</span></div><div role="progressbar" aria-label={`${item.name} supervision load`} aria-valuenow={item.currentLoad} aria-valuemin={0} aria-valuemax={Math.max(1,item.maxLoad)} className="mt-2 h-1 overflow-hidden rounded-full bg-surface-hover"><div className={`h-full rounded-full ${item.available === 0 ? 'bg-warning' : 'bg-primary'}`} style={{width:`${Math.min(100,item.currentLoad / Math.max(1,item.maxLoad)*100)}%`}} /></div></li>)}</ul>{!data.supervisors.length&&<Link href="/department/supervisors" className={textLink}>Add Supervisors</Link>}</div>
          </section>
        </div>
      </div>
      <p className="m-0 text-right text-sm text-text-muted">Last updated {clock(data.generatedAt)}</p>
    </>}
  </div>;
}
