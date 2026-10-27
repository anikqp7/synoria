"use client";
import { Form, Input } from '@/components/validatedForm';
import useInitialLoad from "@/lib/useInitialLoad";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import ActionMessage from "@/components/actionMessage";
import Button from "@/components/button";
import Modal from "@/components/modal";
import TagInput from "@/components/tagInput";
import ResearchTags from "@/components/researchTags";
import { showActionAlert } from "@/lib/actionAlerts";

async function requestAccount(path, { method = "GET", data } = {}) {
  const response = await fetch(path, {
    method, cache: "no-store",
    ...(method !== "GET" ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(data || {}) } : {}),
  });
  const result = await response.json().catch(() => ({ message: "Unable to reach the server. Please try again." }));
  if (!response.ok) throw new Error(result.message);
  return result;
}

export default function MemberManager({ role, profile = null }) {
  const router = useRouter();
  const supervisor = role === "supervisor";
  const faculty = role !== "student";
  const label = role.charAt(0).toUpperCase() + role.slice(1);
  const resource = `${role}s`;
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [feedback, setFeedback] = useState(null);
  const dismissFeedback = useCallback(() => setFeedback(null), []);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try { setMembers((await requestAccount(`/api/${resource}`))[resource]); }
    catch (error) { setLoadError(error.message); setFeedback({ icon: "error", title: `Unable To Load ${label}s`, text: error.message }); }
    finally { setLoading(false); }
  }, [resource, label]);
  useInitialLoad(load, !profile);

  function showForm(member = null) {
    setEditing(member);
    setOpen(true);
  }

  async function save(event) {
    event.preventDefault();
    const fields = Object.fromEntries(new FormData(event.currentTarget));
    if (fields.password !== fields.confirmPassword) return setFeedback({ icon: "error", title: "Passwords Do Not Match", text: "Please enter the same password in both fields." });
    if (editing && !fields.password) delete fields.password;
    delete fields.confirmPassword;
    setBusy(true);
    try {
      const result = await requestAccount(`/api/${resource}${editing ? `/${editing.id}` : ""}`, { method: editing ? "PATCH" : "POST", data: fields });
      const saved = result[role];
      setMembers(current => editing ? current.map(member => member.id === saved.id ? saved : member) : [saved, ...current]);
      setOpen(false);
      setFeedback({ icon: "success", title: `${label} ${editing ? "Updated" : "Created"}`, text: editing ? `${saved.name}’s profile has been updated.` : `${saved.name}’s account is ready. Share their email and the password you set with them directly.` });
      router.refresh();
    } catch (error) { setFeedback({ icon: "error", title: editing ? "Changes Not Saved" : "Account Not Created", text: error.message }); }
    finally { setBusy(false); }
  }

  async function changeStatus(member) {
    setBusy(true);
    const activating = member.isActive === false;
    try {
      const confirmation = await showActionAlert({
        icon: "warning", titleText: `${activating ? "Reactivate" : "Deactivate"} ${label}?`,
        text: activating ? `${member.name} will be able to sign in again. A new sign in is required.` : `${member.name} will lose access immediately. Their profile and history will be kept.`,
        showCancelButton: true, confirmButtonText: activating ? "Reactivate Account" : "Deactivate Account",
        cancelButtonText: "Cancel", focusCancel: true,
      });
      if (!confirmation.isConfirmed) return;
      await requestAccount(`/api/${resource}/${member.id}`, { method: "PATCH", data: { isActive: activating } });
      setFeedback({ icon: "success", title: `Account ${activating ? "Reactivated" : "Deactivated"}`, text: activating ? `${member.name} can sign in again.` : `${member.name} can no longer sign in. Their records have been preserved.` });
      router.refresh();
    } catch (error) { setFeedback({ icon: "error", title: "Status Not Changed", text: error.message }); }
    finally { setBusy(false); }
  }

  async function deleteAccount(member) {
    setBusy(true);
    try {
      const confirmation = await showActionAlert({
        icon: "warning", titleText: `Delete ${label}?`,
        text: `${member.name} will be removed from your department’s account list and will no longer be able to sign in. Existing project and evaluation records will be preserved.`,
        showCancelButton: true, confirmButtonText: `Delete ${label}`, cancelButtonText: "Cancel", focusCancel: true,
      });
      if (!confirmation.isConfirmed) return;
      await requestAccount(`/api/${resource}/${member.id}`, { method: "DELETE" });
      await showActionAlert({ icon: "success", titleText: `${label} Deleted`, text: `${member.name}’s account has been removed.` });
      router.replace(`/department/${resource}`);
      router.refresh();
    } catch (error) { setFeedback({ icon: "error", title: "Account Not Deleted", text: error.message }); }
    finally { setBusy(false); }
  }

  const fields = [
    { key: "name", label: "Full Name", required: true, max: 120, placeholder: supervisor ? "e.g. Dr. Ayesha Rahman" : "e.g. Ayesha Rahman" },
    { key: "email", label: "Email Address", type: "email", required: true, max: 254, placeholder: `${role}@university.edu` },
    { key: "phone", label: "Phone Number", type: "tel", required: true, max: 30, placeholder: "e.g. +880 1712 345678" },
    ...(faculty ? [{ key: "designation", label: "Designation", max: 100, placeholder: "e.g. Assistant Professor" }] : [
      { key: "studentId", label: "Student ID", required: true, max: 50, placeholder: "e.g. 2022-1-60-001" },
      { key: "batch", label: "Batch", max: 50, placeholder: "e.g. 42nd batch" },
      { key: "academicSession", label: "Academic Session", max: 50, placeholder: "e.g. 2022–2023" },
    ]),
  ];

  return (
    <>
      <ActionMessage message={feedback} onDismiss={dismissFeedback} />
      {profile && <div className="flex flex-wrap items-center gap-3"><Button appearance="outline" disabled={busy} onClick={() => showForm(profile)} aria-label={`Edit ${profile.name}`}>Edit</Button><Button variant="danger" appearance="ghost" disabled={busy} onClick={() => changeStatus(profile)} aria-label={`${profile.isActive === false ? "Reactivate" : "Deactivate"} ${profile.name}`}>{profile.isActive === false ? "Reactivate" : "Deactivate"}</Button><Button variant="danger" appearance="outline" disabled={busy} onClick={() => deleteAccount(profile)} aria-label={`Delete ${profile.name}`}>Delete</Button></div>}
      {!profile && <section id={resource} className="mt-7 rounded-panel border border-border bg-surface shadow-panel">
        <div className="mb-5 flex items-center justify-between gap-3 border-b border-border px-6 py-5 max-[760px]:p-5"><div><span className="text-[13px] font-bold tracking-[2px] text-primary">{faculty ? "YOUR DEPARTMENT FACULTY" : "YOUR STUDENT COMMUNITY"}</span><h2 className="mt-2 mb-0 text-lg font-semibold">{label}s <span className="ml-2 rounded-control bg-primary-soft px-2 py-1 align-middle text-[13px] text-primary">{members.length}</span></h2></div><Button size="small" disabled={busy} onClick={() => showForm()}>+ Add {label}</Button></div>
        <div className="px-6 pb-6 max-[760px]:px-5">
          {loading ? <p role="status" className="py-7 text-center text-sm text-text-muted">Loading {resource}…</p> : members.length ? members.map(member => (
            <article key={member.id} className="flex items-start gap-4 border-t border-border py-5 max-[760px]:flex-wrap">
              <div className="grid size-11 shrink-0 place-items-center rounded-control bg-primary-soft text-primary" aria-hidden="true">{member.name.charAt(0).toUpperCase()}</div>
              <div className="min-w-0 flex-1"><h3 className="mt-0 mb-1 text-sm font-semibold [overflow-wrap:anywhere]"><Link href={`/department/${resource}/${member.id}`} className="text-primary underline-offset-4 hover:underline">{member.name}</Link>{member.isActive === false && <span className="ml-2 rounded-control bg-surface-hover px-2 py-1 text-[13px] text-text-muted">Inactive</span>}</h3><p className="m-0 text-[13px] leading-relaxed text-text-muted">{faculty ? member.designation || label : `ID: ${member.studentId}`}</p>{faculty ? <ResearchTags value={member.researchInterests} /> : <p className="mt-1 mb-0 text-[13px] text-text-muted">{[member.batch, member.academicSession].filter(Boolean).join(" · ")}</p>}</div>
              <div className="grid justify-items-end gap-3 max-[760px]:w-full max-[760px]:justify-items-start max-[760px]:pl-15"><div className="grid gap-1 text-right text-[13px] max-[760px]:text-left"><a className="text-primary hover:underline [overflow-wrap:anywhere]" href={`mailto:${member.email}`}>{member.email}</a><a className="text-primary hover:underline" href={`tel:${member.phone}`}>{member.phone}</a></div></div>
            </article>
          )) : !loadError && <div className="px-4 py-8 text-center"><h3 className="text-sm font-semibold">No {resource} added yet.</h3><p className="text-sm text-text-muted">Add your first {role} to give them access to their own account.</p></div>}
          {!loading && loadError && <Button appearance="outline" size="small" onClick={load}>Reload {label}s</Button>}
        </div>
      </section>}
      {open && <Modal key={editing?.id || "new"} title={`${editing ? "Edit" : "Add"} ${label}`} description={editing ? `Update this ${role}’s account information.` : `Create a ${role} account for your department.`} busy={busy} onClose={() => setOpen(false)}>
        <Form onSubmit={save} className="px-6 pb-6"><fieldset disabled={busy}><div className="grid grid-cols-2 gap-x-5 max-[760px]:grid-cols-1">
          {fields.map(field => <div key={field.key}><label htmlFor={`${role}-${field.key}`}>{field.label}{field.required ? " *" : ""}</label><Input id={`${role}-${field.key}`} name={field.key} type={field.type || "text"} required={field.required} maxLength={field.max} defaultValue={editing?.[field.key] || ""} placeholder={field.placeholder} autoComplete="off" /></div>)}
          {supervisor && <div className="col-span-full"><label htmlFor="supervisor-interests">Research Interests</label><TagInput id="supervisor-interests" name="researchInterests" defaultValue={editing?.researchInterests || ""} /></div>}
          <div><label htmlFor={`${role}-password`}>{editing ? "New Password" : "Set Password *"}</label><Input id={`${role}-password`} name="password" type="password" minLength={8} required={!editing} autoComplete="new-password" /><p className="mt-2 mb-0 text-[13px] leading-relaxed text-text-muted">{editing ? "Leave blank to keep the current password." : "At least 8 characters; maximum 72 bytes."}</p></div><div><label htmlFor={`${role}-confirm`}>Confirm Password{editing ? "" : " *"}</label><Input id={`${role}-confirm`} name="confirmPassword" type="password" required={!editing} autoComplete="new-password" /></div>
        </div>{!editing && <p className="mt-4 mb-0 text-[13px] leading-relaxed text-text-muted">Share the assigned email and password with the {role} directly.</p>}<div className="mt-6 ml-auto flex w-fit max-w-full flex-wrap justify-end gap-3"><Button variant="control" appearance="outline" onClick={() => setOpen(false)}>Cancel</Button><Button type="submit">{busy ? "Saving…" : editing ? "Save Changes" : `Create ${label} Account`}</Button></div></fieldset></Form>
      </Modal>}
    </>
  );
}
