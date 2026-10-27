"use client";
import { Form, Input, Select } from '@/components/validatedForm';
import useInitialLoad from "@/lib/useInitialLoad";

import Link from "next/link";
import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/button";
import Modal from "@/components/modal";
import ActionMessage from "@/components/actionMessage";
import { showActionAlert } from "@/lib/actionAlerts";

const types = { project: "Project", thesis: "Thesis", research: "Research" };
const panel = "rounded-panel border border-border bg-surface p-6 shadow-panel max-[640px]:p-5";
async function request(path = "", method = "GET", data) {
  const response = await fetch(`/api/workspaces${path}`, { method, cache: "no-store", ...(method !== "GET" ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(data || {}) } : {}) });
  const result = await response.json().catch(() => ({ message: "Unable to load workspace data. Please try again." }));
  if (!response.ok) throw new Error(result.message || "Please try again.");
  return result;
}
export default function WorkspaceManager({ userId, view = "project", workspaceId }) {
  const router = useRouter();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [modal, setModal] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const dismiss = useCallback(() => setFeedback(null), []);
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { setData(await request(workspaceId ? `/${workspaceId}` : "")); }
    catch (err) { setData(null); setError(err.message); }
    finally { setLoading(false); }
  }, [workspaceId]);
  useInitialLoad(load);
  const workspace = data?.workspace;
  const invitations = data?.invitations || [];
  const draft = workspace?.status === "draft";

  async function mutate(path, method, fields, title, text, navigate) {
    setBusy(true);
    try {
      const result = await request(path, method, fields);
      setModal(null);
      if (navigate) {
        if (navigate !== "created" && !workspaceId) await load();
        await showActionAlert({ icon: "success", titleText: title, text });
        router.push(navigate === "created" ? `/student/team/${result.workspace.id}` : navigate);
      } else {
        await load();
        setFeedback({ icon: "success", title, text });
      }
    } catch (err) { setFeedback({ icon: "error", title: "Action Not Completed", text: err.message }); }
    finally { setBusy(false); }
  }
  function save(event) {
    event.preventDefault();
    const fields = Object.fromEntries(new FormData(event.currentTarget));
    if (modal === "invite") return mutate(`/${workspace.id}/invitations`, "POST", fields, "Invitation Sent", "Your teammate can accept or decline from their Team page.");
    return mutate(modal === "edit" ? `/${workspace.id}` : "", modal === "edit" ? "PATCH" : "POST", fields, modal === "edit" ? "Workspace Updated" : "Workspace Created", "Your draft workspace is ready.", modal === "create" ? "created" : null);
  }
  async function remove(member) {
    setBusy(true);
    const leaving = member.id === userId;
    try {
      const confirmation = await showActionAlert({ icon: "warning", titleText: leaving ? "Leave Team?" : "Remove Team Member?", text: leaving ? "You will lose access to this draft workspace. A new invitation is needed to rejoin." : `${member.name} will lose access to this draft workspace.`, showCancelButton: true, confirmButtonText: leaving ? "Leave Team" : "Remove Member", cancelButtonText: "Cancel", focusCancel: true });
      if (!confirmation.isConfirmed) return;
      await mutate(`/${workspace.id}/members/${member.id}`, "DELETE", {}, leaving ? "Team Left" : "Member Removed", leaving ? "You can now create or join another team." : "The team membership has been updated.", leaving ? "/student/team" : null);
    } finally { setBusy(false); }
  }
  function invitationAction(invite, action) {
    return mutate(`/${invite.workspaceId || workspace.id}/invitations/${invite.id}`, "PATCH", { action }, `Invitation ${action === "accept" ? "Accepted" : action === "decline" ? "Declined" : "Cancelled"}`, action === "accept" ? "You have joined the team. Open Team to see your workspace." : "The invitation has been updated.", action === "accept" ? "/student/team" : null);
  }

  if (loading && !data) return <p className="text-sm text-text-muted" role="status">Loading your workspace…</p>;
  if (error) return <section className={panel}><h2 className="text-lg font-semibold">Workspace Unavailable</h2><p role="alert" className="text-sm text-text-secondary">{error}</p><Button onClick={load} appearance="outline">Try Again</Button></section>;
  return <>
    <ActionMessage message={feedback} onDismiss={dismiss} />
    {view === "overview" ? <section aria-labelledby="dashboardProject" className={`${panel} mt-6`}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-5">
        <h2 id="dashboardProject" className="m-0 text-lg font-semibold">Project</h2>
        {workspace && <span className="rounded-control border border-primary-border bg-primary-soft px-3 py-1 text-sm font-medium text-primary">{{ draft: "Draft", active: "Active", submitted: "Submitted", archived: "Completed" }[workspace.status] || "In Progress"}</span>}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-6 pt-6">
        <div className="min-w-0 flex-1">
          <h3 className="m-0 text-xl font-semibold [overflow-wrap:anywhere]">{workspace ? workspace.name : data.projectLimit?.projectName || "Start Your Project Journey"}</h3>
          <p className="mb-0 mt-2 text-sm leading-relaxed text-text-secondary">{workspace ? `${types[workspace.workType]} · ${workspace.members.length} team member${workspace.members.length === 1 ? "" : "s"}` : data.projectLimit ? "Your project is already registered. Open Team to view its availability." : "Create a project workspace or join your team through an invitation."}</p>
          {workspace && <p className="mb-0 mt-4 text-sm leading-relaxed text-text-secondary [overflow-wrap:anywhere]">{workspace.members.map(member => member.name).join(" · ")}</p>}
        </div>
        <Link className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-control bg-primary px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-primary-active focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary" href={workspace ? `/student/team/${workspace.id}` : "/student/team"}>{workspace ? "View Project" : data.projectLimit ? "View Team" : "Get Started"}</Link>
      </div>
    </section> : view === "invitations" ? <section className={panel}>
      <h2 className="mt-0 text-lg font-semibold">Pending Invitations <span className="ml-2 text-primary">{invitations.length}</span></h2>
      {workspace && <p className="text-sm text-text-secondary">You already belong to {workspace.name}. You can decline invitations; leave your current draft team before accepting another.</p>}
      {invitations.length ? <ul className="m-0 list-none divide-y divide-border p-0">{invitations.map(invite => <li key={invite.id} className="flex flex-wrap items-center justify-between gap-4 py-5"><div className="min-w-0"><h3 className="m-0 text-base font-semibold [overflow-wrap:anywhere]">{invite.workspaceName}</h3><p className="mb-0 mt-2 text-sm text-text-secondary">{types[invite.workType]} · Invited By {invite.leaderName}</p></div><div className="ml-auto flex gap-3"><Button appearance="outline" disabled={busy} onClick={() => invitationAction(invite, "decline")}>Decline</Button><Button disabled={busy || Boolean(workspace)} onClick={() => invitationAction(invite, "accept")}>Accept Invitation</Button></div></li>)}</ul> : <p className="text-sm text-text-muted">No pending invitations. Ask your team leader to invite your student account email.</p>}
    </section> : !workspace ? <section className={panel}><h2 className="mt-0 text-xl font-semibold">Start Your Project Or Thesis</h2><p className="max-w-xl text-sm leading-relaxed text-text-secondary">Create a draft workspace and invite students from your department. If someone has already invited you, accept their invitation to join the team.</p><div className="mt-5 flex flex-wrap items-center gap-5"><Button onClick={() => setModal("create")} disabled={busy}>Create Workspace</Button><Link className="text-sm font-semibold text-primary hover:underline" href="/student/team#teamInvitations">View Invitations</Link></div></section> : <div className="space-y-6">
      <section className={panel}><div className="flex flex-wrap items-start justify-between gap-4"><div className="min-w-0"><p className="mt-0 text-sm font-semibold text-primary">{types[workspace.workType]} · {workspace.status === "draft" ? "Draft" : workspace.status === "active" ? "Active" : "Submitted"}</p><h2 className="m-0 text-2xl font-semibold [overflow-wrap:anywhere]">{workspace.name}</h2><p className="mb-0 text-sm text-text-secondary">{workspace.isLeader ? "You are the team leader." : "You are a member of this team."}</p></div>{workspace.isLeader && draft && <Button appearance="outline" disabled={busy} onClick={() => setModal("edit")}>Edit Workspace</Button>}</div><Link href="/student/proposal" className="mt-5 inline-block text-sm font-semibold text-primary hover:underline">Open Proposal →</Link><p className="mb-0 mt-5 text-sm leading-relaxed text-text-muted">{draft ? "Form your team before preparing the proposal. Only the team leader can update workspace details." : "Team changes are locked after the draft stage."}</p></section>
      <section className={panel}><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="m-0 text-lg font-semibold">Team Members <span className="ml-2 text-primary">{workspace.members.length}</span></h2>{workspace.isLeader && draft && <Button size="small" disabled={busy} onClick={() => setModal("invite")}>Invite Student</Button>}</div><ul className="mb-0 mt-5 list-none divide-y divide-border p-0">{workspace.members.map(member => <li key={member.id} className="flex flex-wrap items-center justify-between gap-3 py-4"><div className="min-w-0"><h3 className="m-0 text-sm font-semibold [overflow-wrap:anywhere]">{member.name}{member.id === userId ? " (You)" : ""}<span className="ml-2 text-[13px] font-normal text-primary">{member.id === workspace.leaderId ? "Team Leader" : "Member"}</span></h3><p className="mb-0 mt-2 text-sm text-text-secondary [overflow-wrap:anywhere]">{member.studentId} · {member.email}{!member.isActive ? " · Inactive Account" : ""}</p></div>{draft && member.id !== workspace.leaderId && (workspace.isLeader || member.id === userId) && <Button size="small" variant="danger" appearance="ghost" disabled={busy} onClick={() => remove(member)}>{member.id === userId ? "Leave Team" : "Remove Member"}</Button>}</li>)}</ul>{workspace.isLeader && <p className="mb-0 text-[13px] leading-relaxed text-text-muted">The team leader stays with the workspace. Members can leave or be removed while it is a draft.</p>}</section>
      {workspace.isLeader && <section className={panel}><h2 className="mt-0 text-lg font-semibold">Invitation History</h2>{workspace.invitations.length ? <ul className="m-0 list-none divide-y divide-border p-0">{workspace.invitations.map(invite => <li key={invite.id} className="flex flex-wrap items-center justify-between gap-3 py-4"><div className="min-w-0"><p className="m-0 text-sm font-medium [overflow-wrap:anywhere]">{invite.student?.name || "Unavailable Account"}</p><p className="mb-0 mt-1 text-sm text-text-secondary [overflow-wrap:anywhere]">{invite.student?.email}</p><span className="mt-1 inline-block text-[13px] text-text-muted">{{ pending: "Pending", accepted: "Accepted", declined: "Declined", cancelled: "Cancelled" }[invite.status]}</span></div>{draft && invite.status === "pending" && <Button appearance="outline" size="small" disabled={busy} onClick={() => invitationAction(invite, "cancel")}>Cancel Invitation</Button>}</li>)}</ul> : <p className="mb-0 text-sm text-text-muted">No invitations sent yet.</p>}</section>}
    </div>}
    {modal && <Modal title={modal === "invite" ? "Invite Student" : modal === "edit" ? "Edit Workspace" : "Create Workspace"} description={modal === "invite" ? "Invite a student from your department using their account email." : "Choose your work type and a short name for your team workspace."} busy={busy} onClose={() => setModal(null)}><Form onSubmit={save} className="px-6 pb-6"><fieldset disabled={busy}>{modal === "invite" ? <><label htmlFor="inviteEmail">Student Email *</label><Input id="inviteEmail" name="email" type="email" maxLength={254} required placeholder="student@university.edu" autoComplete="off" /></> : <><label htmlFor="workspaceName">Workspace Name *</label><Input id="workspaceName" name="name" maxLength={120} required defaultValue={modal === "edit" ? workspace.name : ""} placeholder="e.g. CSE Research Team 12" /><label htmlFor="workType">Work Type *</label><Select id="workType" name="workType" required defaultValue={modal === "edit" ? workspace.workType : "project"}>{Object.entries(types).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select></>}<div className="ml-auto mt-6 flex w-fit flex-wrap justify-end gap-3"><Button variant="control" appearance="outline" onClick={() => setModal(null)}>Cancel</Button><Button type="submit">{busy ? "Saving…" : modal === "invite" ? "Send Invitation" : modal === "edit" ? "Save Changes" : "Create Workspace"}</Button></div></fieldset></Form></Modal>}
  </>;
}
