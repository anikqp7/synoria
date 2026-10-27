"use client";
import { Select } from '@/components/validatedForm';
import {useCallback,useState} from 'react';
import useInitialLoad from '@/lib/useInitialLoad';
import EvaluationAssignment from '@/components/evaluationAssignment';
import Button from '@/components/button';
const projectLabel=project=>project.title===project.workspaceName?project.title:`${project.title} · ${project.workspaceName}`;
export default function ExaminerAssignments(){
 const [data,setData]=useState(null),[error,setError]=useState(''),[selected,setSelected]=useState(''),[loading,setLoading]=useState(true);
 const load=useCallback(async()=>{setLoading(true);try{const response=await fetch('/api/supervision',{cache:'no-store'}),result=await response.json();if(!response.ok)throw Error(result.message);setData(result);setSelected(current=>result.proposals.some(project=>project.workspaceId===current)?current:'');setError('');}catch(error){setError(error.message);}finally{setLoading(false);}},[]);
 useInitialLoad(load);
 const project=data?.proposals.find(item=>item.workspaceId===selected);
 return <div className="space-y-5">
  <section className="rounded-panel border border-border bg-surface p-5 sm:p-6"><div className="mb-5 flex flex-wrap items-center justify-between gap-3"><div><h2 className="m-0 text-lg font-semibold">Select A Team / Project</h2><p className="mb-0 mt-2 text-sm text-text-secondary">Choose which assigned project you want to submit for evaluation.</p></div><Button size="small" appearance="outline" disabled={loading} onClick={load}>Refresh Projects</Button></div><label htmlFor="examinerAssignmentProject" className="mt-0">Team / Project</label><Select id="examinerAssignmentProject" value={selected} disabled={loading||!data?.proposals.length||!!error} onChange={event=>setSelected(event.target.value)}><option value="">Select A Team / Project</option>{data?.proposals.map(item=><option key={item.workspaceId} value={item.workspaceId}>{projectLabel(item)}</option>)}</Select></section>
  {error&&<p role="alert" className="rounded-control border border-danger-border bg-danger-soft p-4 text-sm text-danger">{error}</p>}
  {loading&&!data&&<p role="status" className="text-sm text-text-muted">Loading assigned projects…</p>}
  {!error&&project&&<article><h2 className="mb-3 mt-0 text-lg font-semibold [overflow-wrap:anywhere]">{projectLabel(project)}</h2><EvaluationAssignment key={project.workspaceId} workspaceId={project.workspaceId}/></article>}
  {!error&&data&&!data.proposals.length&&<p className="rounded-panel border border-border bg-surface p-6 text-sm text-text-secondary">No assigned projects yet.</p>}
 </div>;
}
