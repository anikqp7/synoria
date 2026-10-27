"use client";
import { Form, Input } from '@/components/validatedForm';
import useInitialLoad from '@/lib/useInitialLoad';
import { useCallback, useState } from 'react';
import Button from '@/components/button';
import Modal from '@/components/modal';
import ActionMessage from '@/components/actionMessage';
import { showActionAlert } from '@/lib/actionAlerts';

function CapacityEditor({ supervisor, onClose, onSaved }) {
  const [capacity, setCapacity] = useState(supervisor.maxLoad), [busy, setBusy] = useState(false);
  async function save(event) {
    event.preventDefault(); setBusy(true);
    try {
      const response = await fetch(`/api/supervisorLoads/${supervisor.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ maxLoad: Number(capacity) }) });
      const result = await response.json(); if (!response.ok) throw new Error(result.message);
      await onSaved();
    } catch (error) { await showActionAlert({ icon: 'error', titleText: 'Capacity Not Updated', text: error.message }); }
    finally { setBusy(false); }
  }
  return <Modal title="Edit Capacity" description={supervisor.name} busy={busy} onClose={onClose}><Form onSubmit={save} className="p-6"><fieldset disabled={busy}>
    <p className="mt-0 text-sm text-text-secondary">Currently assigned: <span className="font-semibold text-foreground">{supervisor.currentLoad}</span></p>
    <label htmlFor="supervisorCapacity" className="mb-2 mt-4">Total Capacity</label><Input id="supervisorCapacity" type="number" min={supervisor.currentLoad} max={1000} step={1} required value={capacity} onChange={event => setCapacity(event.target.value)} />
    <p className="text-[13px] text-text-muted">{Math.max(0, Number(capacity) - supervisor.currentLoad)} places available after saving. Capacity cannot be lower than the assigned load.</p>
    <div className="mt-6 flex justify-end gap-3"><Button appearance="outline" disabled={busy} onClick={onClose}>Cancel</Button><Button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save Capacity'}</Button></div>
  </fieldset></Form></Modal>;
}
export default function SupervisorCapacity({ supervisorId }) {
  const [items, setItems] = useState([]), [loading, setLoading] = useState(true), [error, setError] = useState(''), [editor, setEditor] = useState(null), [feedback, setFeedback] = useState(null);
  const dismiss = useCallback(() => setFeedback(null), []);
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try { const response = await fetch('/api/supervisorLoads', { cache: 'no-store' }); const data = await response.json(); if (!response.ok) throw new Error(data.message); setItems(data.supervisors); }
    catch (error) { setError(error.message); }
    finally { setLoading(false); }
  }, []);
  useInitialLoad(load);
  const visible = supervisorId ? items.filter(item => item.id === supervisorId) : items;
  return <section className="rounded-panel border border-border bg-surface shadow-panel">
    <ActionMessage message={feedback} onDismiss={dismiss} />
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-5 sm:p-6"><div><h2 className="m-0 text-lg font-semibold">Loads & Capacity</h2><p className="mb-0 mt-2 text-sm text-text-muted">Active assignments and available places.</p></div><Button appearance="outline" size="small" disabled={loading} onClick={load}>Refresh Loads</Button></header>
    {loading ? <p role="status" className="p-6 text-sm text-text-muted">Loading supervisor loads…</p> : error ? <p role="alert" className="p-6 text-sm text-danger">{error}</p> : visible.length ? <ul className="m-0 list-none divide-y divide-border p-0">{visible.map(item => <li key={item.id} className="flex flex-wrap items-center justify-between gap-x-8 gap-y-5 p-5 sm:p-6">
      <div className="order-1 min-w-0 flex-1"><h3 className="m-0 text-sm font-semibold [overflow-wrap:anywhere]">{item.name}</h3>{!item.isActive && <p className="mb-0 mt-1 text-[13px] text-text-muted">Inactive Account</p>}</div>
      <dl className="order-3 m-0 grid w-full grid-cols-3 gap-5 lg:order-2 lg:w-auto lg:gap-10">{[['Assigned',item.currentLoad],['Capacity',item.maxLoad],['Available',item.available]].map(([label,value]) => <div key={label}><dt className="mb-1 text-[13px] text-text-muted">{label}</dt><dd className={`m-0 text-lg font-semibold tabular-nums ${label === 'Available' ? 'text-primary' : ''}`}>{value}</dd></div>)}</dl>
      <Button appearance="outline" size="small" className="order-2 shrink-0 lg:order-3" onClick={() => setEditor(item)}>Edit Capacity</Button>
    </li>)}</ul> : <p className="p-6 text-sm text-text-muted">No Supervisors Found</p>}
    {editor && <CapacityEditor supervisor={editor} onClose={() => setEditor(null)} onSaved={async () => { setEditor(null); await load(); setFeedback({ icon: 'success', title: 'Capacity Updated', text: 'The supervisor’s capacity has been updated.' }); }} />}
  </section>;
}
