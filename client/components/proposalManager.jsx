"use client";
import { Form, Input, Select, Textarea } from '@/components/validatedForm';
import ProposalPeriod from "@/components/proposalPeriod";
import useInitialLoad from "@/lib/useInitialLoad";
import Link from "next/link";
import { useCallback, useState } from "react";
import Button from "@/components/button";
import ActionMessage from "@/components/actionMessage";
import ProposalHistory from "@/components/proposalHistory";
import ProposalReviewActions from "@/components/proposalReviewActions";

import AssignmentManager from "@/components/assignmentManager";
import ProposalDetails, { proposalDate } from "@/components/proposalDetails";
import { showActionAlert } from "@/lib/actionAlerts";
const panel = "rounded-panel border border-border bg-surface p-6 shadow-panel";
const empty = { workType: "project", title: "", abstract: "", researchArea: "", supervisorPreference: "" };
async function api(path, method = "GET", data) {
  const response = await fetch(path, { method, cache: "no-store", ...(data ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) } : {}) });
  const result = await response.json().catch(() => ({ message: "Unable to load proposals. Please try again." }));
  if (!response.ok) throw new Error(result.message || "Please try again.");
  return result;
}
export default function ProposalManager({ coordinator = false, supervisor = false, workspaceId }) {
  const [period,setPeriod]=useState(null);
  const periodOpen=!!period?.accepting&&(!period.deadline||new Date(period.deadline)>new Date());
  const [proposal, setProposal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [fields, setFields] = useState(empty);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const dismiss = useCallback(() => setFeedback(null), []);
  const load = useCallback(async () => {
    setError(""); setLoading(true);
    try {
      const id = (coordinator || supervisor) ? workspaceId : (await api('/api/workspaces')).workspace?.id;
      if (!id) { setProposal(null); return; }
      const result = await api(supervisor ? `/api/supervision/${id}` : coordinator ? `/api/proposals/${id}` : `/api/workspaces/${id}/proposal`);
      setProposal(result.proposal);
      if (!coordinator && !supervisor) { const draft = result.proposal.draft; setFields({ workType: result.proposal.workType, title: draft.title || "", abstract: draft.abstract || "", researchArea: draft.researchArea || "", supervisorPreference: draft.supervisorPreference || "" }); setDirty(false); }
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }, [coordinator, supervisor, workspaceId]);
  useInitialLoad(load);
  function change(event) { setFields(current => ({ ...current, [event.target.name]: event.target.value })); setDirty(true); }
  async function save(event) {
    event.preventDefault(); setBusy(true);
    try {
      const result = await api(`/api/workspaces/${proposal.workspaceId}/proposal`, "PATCH", { ...fields, revision: proposal.revision });
      setProposal(current => ({ ...current, revision: result.revision, workType: fields.workType, draft: { ...fields, savedAt: new Date().toISOString() } }));
      setDirty(false); setFeedback({ icon: "success", title: "Draft Saved", text: "Your team can now view the saved proposal." });
    } catch (err) { setFeedback({ icon: "error", title: "Draft Not Saved", text: err.message }); }
    finally { setBusy(false); }
  }
  async function submit() {
    setBusy(true);
    try {
      const confirmation = await showActionAlert({ icon: "question", titleText: "Submit Proposal?", text: "Your saved proposal will be submitted as a new version. Editing stays locked until the supervisor requests a revision.", showCancelButton: true, confirmButtonText: "Submit Proposal", cancelButtonText: "Cancel", focusCancel: true });
      if (!confirmation.isConfirmed) return;
      await api(`/api/workspaces/${proposal.workspaceId}/proposal/submit`, "POST", { revision: proposal.revision });
      await load(); setFeedback({ icon: "success", title: "Proposal Submitted", text: "Your team, coordinator and assigned supervisor can view the submitted proposal." });
    } catch (err) { setFeedback({ icon: "error", title: "Proposal Not Submitted", text: err.message }); }
    finally { setBusy(false); }
  }
  const notice=!coordinator&&!supervisor?<ProposalPeriod onChange={setPeriod}/>:null;
  if (loading) return <>{notice}<p role="status" className="text-sm text-text-muted">Loading proposal…</p></>;
  if (error) return <>{notice}<section className={panel}><h2 className="text-lg font-semibold">Proposal Unavailable</h2><p role="alert" className="text-sm text-text-secondary">{error}</p><Button onClick={load} appearance="outline">Reload Proposal</Button></section></>;
  if (!proposal) return <>{notice}<section className={panel}><h2 className="mt-0 text-lg font-semibold">Create Or Join A Team First</h2><p className="text-sm text-text-secondary">Your project workspace connects your proposal with your team.</p><Link href="/student/team" className="text-sm font-semibold text-primary hover:underline">Open Team →</Link></section></>;
  return <>{notice}{!coordinator && <Link href={`/${supervisor ? "supervisor" : "student"}/chat/${proposal.workspaceId}`} className="mb-6 inline-block text-sm font-semibold text-primary hover:underline">Open Chat →</Link>}<ActionMessage message={feedback} onDismiss={dismiss} />{!coordinator && <ProposalReviewActions proposal={proposal} supervisor={supervisor} onReload={load} />}{coordinator || supervisor || !(proposal.canEditByRole ?? proposal.canEdit) || !periodOpen ? <>{!coordinator && <p className="mb-5 text-sm text-text-secondary">{proposal.submission ? "This submitted version is preserved. Review decisions and previous versions are shown below." : !periodOpen ? "Drafting and submission are unavailable during the current proposal period. You can view your saved work below." : "Only the team leader can edit and submit. You can view the saved draft below."}</p>}{coordinator && <div className="mb-6 space-y-6"><AssignmentManager workspaceId={proposal.workspaceId} preferredId={proposal.submission?.supervisorPreference?.id} onAssigned={load} /></div>}<ProposalDetails proposal={proposal} draft={!coordinator && !supervisor && (!proposal.submission || proposal.canRevise)} /></> : <>
    <section className={panel}><h2 className="mt-0 text-xl font-semibold">{proposal.workspaceName}</h2><p className="text-sm text-text-secondary">{proposal.canRevise ? "Update the proposal using the review instructions below. Submit a new version when ready." : "Save your draft as you work. Complete every field before submitting."}</p><p className="mb-0 text-sm text-text-muted">{dirty ? "You have unsaved changes." : proposal.draft.savedAt ? `Last Saved ${proposalDate(proposal.draft.savedAt)}` : "No draft saved yet."}</p></section>
    <Form onSubmit={save} className={`${panel} mt-6`}><fieldset disabled={busy}>
      <label htmlFor="proposalWorkType">Work Type *</label><Select id="proposalWorkType" name="workType" value={fields.workType} onChange={change} disabled={!!proposal.submission}><option value="project">Project</option><option value="thesis">Thesis</option><option value="research">Research</option></Select>
      <label htmlFor="proposalTitle">Proposal Title *</label><Input id="proposalTitle" name="title" maxLength={200} value={fields.title} onChange={change} placeholder="Enter your project or thesis title" />
      <label htmlFor="proposalAbstract">Abstract *</label><Textarea id="proposalAbstract" name="abstract" maxLength={4000} rows={8} value={fields.abstract} onChange={change} placeholder="Describe the problem, objectives, approach and expected outcomes" /><p className="mt-2 text-right text-[13px] text-text-muted">{fields.abstract.length} / 4000</p>
      <label htmlFor="proposalArea">Research Area *</label><Input id="proposalArea" name="researchArea" maxLength={120} value={fields.researchArea} onChange={change} placeholder="e.g. Natural Language Processing" />
      {proposal.rankedSupervisorChoices ? <div className="mt-5 rounded-control border border-border bg-surface-hover p-4"><p className="m-0 text-sm text-text-secondary">Supervisor preferences are managed in your team’s Supervisor tab.</p><Link href="/student/supervisor" className="mt-2 inline-block text-sm font-semibold text-primary hover:underline">View Supervisor Choices</Link></div> : <>
      <label htmlFor="proposalSupervisor">Supervisor Preference *</label><Select id="proposalSupervisor" name="supervisorPreference" value={fields.supervisorPreference} onChange={change}><option value="">Choose A Supervisor</option>{proposal.selectedSupervisor && !proposal.supervisors.some(item => item.id === proposal.selectedSupervisor.id) && <option disabled value={proposal.selectedSupervisor.id}>{proposal.selectedSupervisor.name} (Unavailable)</option>}{proposal.supervisors.map(item => <option key={item.id} value={item.id}>{item.name}{item.designation ? ` · ${item.designation}` : ""}</option>)}</Select>
      <p className="text-sm leading-relaxed text-text-muted">This is your preference. The coordinator will assign the supervisor.</p>{!proposal.supervisors.length && <p className="text-sm text-text-secondary">No active supervisors are available. Ask your coordinator to add one.</p>}
      </>}
      <h3 className="mt-7 text-base font-semibold">Team Members</h3><ul className="list-none space-y-2 pl-0 text-sm text-text-secondary">{proposal.members.map(member => <li key={member.id}>{member.name} · {member.studentId}{member.isLeader ? " · Team Leader" : ""}{!member.isActive ? " · Inactive Account" : ""}</li>)}</ul><Link href="/student/team" className="text-sm text-primary hover:underline">Manage Team →</Link>
      {proposal.pendingInvitations > 0 && <p className="text-sm text-text-secondary">Resolve or cancel {proposal.pendingInvitations} pending invitation(s) before submitting.</p>}
      <div className="ml-auto mt-7 flex w-fit flex-wrap justify-end gap-3"><Button appearance="outline" onClick={load}>Reload Saved Draft</Button><Button type="submit">{busy ? "Saving…" : "Save Draft"}</Button><Button disabled={dirty || !fields.title.trim() || !fields.abstract.trim() || !fields.researchArea.trim() || !fields.supervisorPreference || proposal.pendingInvitations > 0} onClick={submit}>Submit Proposal</Button></div>
    </fieldset></Form>
  </>}<ProposalHistory proposal={proposal} /></>;
}
