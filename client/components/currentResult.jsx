"use client";
import Link from 'next/link';
import { useEffect, useState } from 'react';
import Button from '@/components/button';
import { dateFor } from '@/lib/monitoringFormat';

export default function CurrentResult({ role }) {
  const [result, setResult] = useState(null), [error, setError] = useState(''), [tick, setTick] = useState(0), [loaded, setLoaded] = useState(false);
  useEffect(() => {
    let current = true, running = false; const controller = new AbortController();
    async function load() {
      if (running) return; running = true;
      try {
        const response = await fetch('/api/defences?status=published&sort=latestPublished', { cache: 'no-store', signal: controller.signal });
        const data = await response.json(); if (!response.ok) throw new Error(data.message || 'Unable to load your result.');
        if (current) { setResult(role==='student'?data.schedules.slice(0,1):data.schedules); setError(''); }
      } catch (error) { if (current && error.name !== 'AbortError') setError(error.message); }
      finally { running = false; if (current) setLoaded(true); }
    }
    load(); const refresh = () => { if (document.visibilityState === 'visible') load(); };
    const timer = setInterval(refresh, 30000); window.addEventListener('focus', refresh);
    return () => { current = false; controller.abort(); clearInterval(timer); window.removeEventListener('focus', refresh); };
  }, [tick,role]);
  if (error) return <div role="alert" className="rounded-panel border border-danger-border bg-danger-soft p-5"><p className="mt-0 text-sm text-danger">{error}</p><Button appearance="outline" size="small" onClick={() => setTick(value => value + 1)}>Try Again</Button></div>;
  if (!loaded) return null;
  if (!result?.length) return <section role="status" className="rounded-panel border border-border bg-surface px-6 py-12 text-center"><h2 className="m-0 text-lg font-semibold">Result Not Available Yet</h2><p className="mb-0 mt-2 text-sm text-text-muted">Your published result will appear here.</p></section>;
  return <div className="space-y-5">{result.map(result=><section key={result.id} aria-label="Current result" className="rounded-panel border border-border bg-surface p-6 sm:p-8"><div className="flex flex-wrap items-start justify-between gap-6"><div className="min-w-0"><h2 className="m-0 text-xl font-semibold [overflow-wrap:anywhere]">{result.workspaceName}</h2><p className="mb-0 mt-2 text-sm text-text-secondary [overflow-wrap:anywhere]">{result.title}</p><p className="mb-0 mt-4 text-[13px] text-text-muted">Published {dateFor(result.result.publishedAt)}</p><p className="mb-0 mt-3 text-sm font-semibold text-primary">Grade: {result.result.letterGrade} · Grade Point: {result.result.gradePoint?.toFixed(2)} / 4.00</p></div><p className="m-0 shrink-0 text-4xl font-semibold text-primary">{result.result.weightedTotal.toFixed(2)} <span className="text-base font-normal text-text-muted">/ 100</span></p></div><Link href={`/${role}/defences/${result.id}`} className="mt-6 inline-block text-sm font-semibold text-primary hover:underline">View Result →</Link></section>)}</div>;
}
