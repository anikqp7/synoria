"use client";
import {useCallback,useState} from "react";
import Link from "next/link";
import useInitialLoad from "@/lib/useInitialLoad";
import EvaluationAssignment from '@/components/evaluationAssignment';
import SubmissionPeriod from '@/components/submissionPeriod';
import Button from "@/components/button";
export default function SupervisorProject({workspaceId}){
 const [project,setProject]=useState(null),[error,setError]=useState('');
 const load=useCallback(async()=>{try{setError('');const response=await fetch(`/api/supervision/${workspaceId}`,{cache:'no-store'});const result=await response.json();if(!response.ok)throw Error(result.message);setProject(result.proposal);}catch(e){setError(e.message);}},[workspaceId]);
 useInitialLoad(load);
 const panel='rounded-panel border border-border bg-surface p-5 sm:p-6';
 const action='inline-flex min-h-10 items-center justify-center rounded-control border px-4 py-2 text-sm font-semibold';
 if(error)return <section className={panel}><p role="alert" className="text-text-secondary">{error}</p><Button appearance="outline" onClick={load}>Try Again</Button></section>;
 if(!project)return <p role="status" className="text-text-secondary">Loading project…</p>;
 const content=project.approvedScope?.submission||project.submission,members=project.members||content?.members||[];
 return <div className="space-y-5"><Link href="/supervisor/projects" className="text-sm font-medium text-primary">← Assigned Projects</Link><section className={panel}><p className="mb-2 mt-0 text-sm font-medium text-primary">{{project:'Final Year Project',thesis:'Thesis',research:'Research'}[project.workType]}</p><h1 className="m-0 text-2xl font-semibold leading-relaxed [overflow-wrap:anywhere]">{content?.title||project.workspaceName}</h1><p className="mb-0 mt-2 text-sm text-text-secondary [overflow-wrap:anywhere]">{project.workspaceName}</p><div className="mt-5 flex flex-wrap gap-3"><Link href={`/supervisor/resources/${workspaceId}`} className={`${action} border-primary bg-primary text-white hover:bg-primary-active`}>Project Resources</Link><Link href={`/supervisor/chat/${workspaceId}`} className={`${action} border-border text-text-secondary hover:bg-surface-hover`}>Open Chat</Link></div></section>
 <section className={panel}><h2 className="mt-0 text-lg font-semibold">Project Details</h2><p className="mb-0 whitespace-pre-wrap text-sm leading-loose text-text-secondary [overflow-wrap:anywhere]">{content?.abstract||'Project details have not been provided yet.'}</p>{content?.researchArea&&<div className="mt-5 border-t border-border pt-4"><h3 className="m-0 text-sm font-semibold">Research Area</h3><p className="mb-0 mt-2 text-sm text-text-secondary [overflow-wrap:anywhere]">{content.researchArea}</p></div>}</section>
 <SubmissionPeriod evaluation/><EvaluationAssignment workspaceId={workspaceId}/><section className={panel}><h2 className="mt-0 text-lg font-semibold">Team Members <span className="ml-2 text-primary">{members.length}</span></h2><ul className="m-0 list-none divide-y divide-border p-0">{members.map(member=><li key={member.id} className="flex flex-wrap items-center justify-between gap-3 py-4"><div className="min-w-0"><h3 className="m-0 text-sm font-semibold [overflow-wrap:anywhere]">{member.name}{member.isLeader&&<span className="ml-2 font-normal text-primary">Team Leader</span>}</h3><p className="mb-0 mt-1 text-sm text-text-secondary">{member.studentId}</p></div><span className="text-sm font-medium text-primary">{member.role||'Member'}</span></li>)}</ul></section></div>;
}
