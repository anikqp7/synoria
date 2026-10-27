"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { sidebarSnapshot, sidebarSubscribe, sidebarServerSnapshot, setSidebarCollapsed } from "@/lib/sidebarPreference";
import Link from "next/link";
import { usePathname } from "next/navigation";
import BrandLogo from "@/components/brandLogo";
import NotificationProvider from "@/components/notificationProvider";
import NotificationBell from "@/components/notificationBell";
import ThemeSwitcher from "@/components/themeSwitcher";
import { dashboardForRole, roleDefinitions, canManageAccounts } from "@/lib/roles";
import ChatUnreadBadge from "@/components/chatUnreadBadge";
import SignOutButton from "@/components/signOutButton";

function Icon({ name, className = "size-5" }) {
  const paths = {
    menu: <path d="M4 6h16M4 12h16M4 18h16" />,
    close: <path d="m6 6 12 12M18 6 6 18" />,
    chevron: <path d="m14 6-6 6 6 6" />,
    overview: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
    supervisors: <><circle cx="8" cy="7" r="3" /><path d="M2 21v-3a6 6 0 0 1 12 0v3M16 3h6v13h-5M17 7h2M17 11h2M8 13v5l3-2" /></>,
    results: <><circle cx="12" cy="8" r="5" /><path d="m8 12-2 9 6-3 6 3-2-9m-6-4 1.5 1.5L14 7" /></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M7 3v4M17 3v4M3 11h18m-13 5 2 2 4-4" /></>,
    rubric: <><rect x="4" y="3" width="16" height="18" rx="2" /><path d="m7 8 1 1 2-2m-3 6 1 1 2-2M13 8h4M13 13h4M7 18h10" /></>,
    projects: <><path d="M3 7V5a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v2M3 7h15a2 2 0 0 1 2 2l-2 10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2Z" /></>,
    proposal: <><path d="M13 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-8M7 8h3M7 12h2m3 3 1-4 7-7 3 3-7 7-4 1Z" /></>,
    supervision: <><circle cx="8" cy="7" r="3" /><path d="M2 21v-3a6 6 0 0 1 12 0v3M16 5h6M16 10h6m-5 6 2 2 4-4" /></>,
    capacity: <><path d="M4 20h16M5 16V9h3v7M11 16V4h3v12M17 16v-5h3v5" /></>,
    examiner: <><path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Z" /><path d="m8 12 3 3 5-6" /></>,
    resources: <><path d="M14 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8Z" /><path d="M14 3v5h5M7 12h10M7 16h7" /></>,
    assigned: <><path d="M3 7V5a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" /><path d="m8 13 3 3 5-5" /></>,
    invitations: <><rect x="2" y="5" width="20" height="14" rx="2" /><path d="m2 6 10 7L22 6M18 14v6M15 17h6" /></>,
    team: <><circle cx="9" cy="7" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3M16 4a3 3 0 0 1 0 6M21 21v-3a6 6 0 0 0-4-5"/></>,
    students: <><path d="m2 9 10-5 10 5-10 5-10-5ZM6 11v6c4 3 8 3 12 0v-6M22 9v7" /></>,
    chat: <><path d="M21 11.5a8 8 0 0 1-8 8H6l-4 3v-11a8 8 0 0 1 8-8h3a8 8 0 0 1 8 8Z" /><path d="M7 10h9M7 14h6" /></>,
    bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /></>,
    account: <><circle cx="12" cy="8" r="4" /><path d="M4 21v-2a8 8 0 0 1 16 0v2" /></>,
  };
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">{paths[name]}</svg>;
}

export default function DashboardShell({ user, children }) {
  const collapsed = useSyncExternalStore(sidebarSubscribe, sidebarSnapshot, sidebarServerSnapshot);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const openButton = useRef(null);
  const closeButton = useRef(null);
  const drawer = useRef(null);
  const fullPageChat = pathname === '/student/chat' || /^\/(student|supervisor)\/chat\/[^/]+$/.test(pathname);
  const role = user.role || "department";
  const dashboard = dashboardForRole(role);
  const roleLabel = roleDefinitions[role].label;
  const links = [
    { href: dashboard, label: "Dashboard", icon: "overview" },
    ...(canManageAccounts(role) ? [
      { href: "/department/supervisors", label: "Supervisors", icon: "supervisors" },
      { href: "/department/supervisorLoads", label: "Supervisor Loads", icon: "capacity" },
      { href: "/department/manageSupervision", label: "Manage Supervision", icon: "supervision" },
      { href: "/department/students", label: "Students", icon: "students" },
      { href: "/department/examiners", label: "Examiners", icon: "examiner" },
      { href: "/department/proposals", label: "Proposals", icon: "proposal" },
    ] : []),
    ...(["student", "supervisor"].includes(role) ? [{ href: `/${role}/chat`, label: "Chat", icon: "chat", chat: true }] : []),
    ...(role === "supervisor" ? [{ href: "/supervisor/projects", label: "Assigned Projects", icon: "assigned" }, { href: "/supervisor/proposals", label: "Proposals", icon: "proposal" }] : []),
    ...(role === "student" ? [
      { href: "/student/team", label: "Team", icon: "team" },
      { href: "/student/supervisor", label: "Supervisor", icon: "supervisors" },
      { href: "/student/resources", label: "Project Resources", icon: "resources" },
      { href: "/student/proposal", label: "Proposal", icon: "proposal" },
    ] : []),
    ...(["department", "supervisor"].includes(role) ? [{ href: `/${role}/resources`, label: "Project Resources", icon: "resources" }] : []),
    { href: `/${role}/defences`, label: "Defence Schedules", icon: "calendar" },
    ...(canManageAccounts(role) ? [{href:"/department/evaluationControl",label:"Examiner Control",icon:"rubric"}] : []),
    ...(role === "supervisor" ? [{href:"/supervisor/evaluationAssignments",label:"Examiner Assignment",icon:"examiner"}] : []),
    { href: `/${role}/results`, label: role === "examiner" ? "Evaluation" : "Results", icon: role === "examiner" ? "rubric" : "results" },
  ];
  const hideLabel = "";

  useEffect(() => {
    if (!mobileOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButton.current?.focus();
    function onKeyDown(event) {
      if (event.key === "Escape") { setMobileOpen(false); openButton.current?.focus(); }
      if (event.key === "Tab") {
        const elements = drawer.current?.querySelectorAll('a[href], button:not([disabled])');
        if (!elements?.length) return;
        const first = elements[0];
        const last = elements[elements.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    }
    const desktop = window.matchMedia("(min-width: 761px)");
    const onResize = () => { if (desktop.matches) setMobileOpen(false); };
    document.addEventListener("keydown", onKeyDown);
    desktop.addEventListener("change", onResize);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
      desktop.removeEventListener("change", onResize);
    };
  }, [mobileOpen]);

  function toggleDesktop() {
    const next = !collapsed;
    setSidebarCollapsed(next);
    if (next) openButton.current?.focus();
  }

  function closeMobile() {
    setMobileOpen(false);
    openButton.current?.focus();
  }

  return (
    <NotificationProvider key={`${role}:${user.id}`} role={role} userId={user.id}><div className={fullPageChat ? "flex h-dvh flex-col overflow-hidden" : "min-h-screen"}>
      <header className="sticky top-0 z-40 flex h-[76px] shrink-0 items-center justify-between gap-4 border-b border-border bg-surface px-5">
        <div className="flex items-center gap-3">
          <BrandLogo href={dashboard} />
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <NotificationBell role={role} />
          <ThemeSwitcher />
          <Link href={`/${role}/account`} aria-label={role === "department" ? "Department Account" : "My Account"} title={role === "department" ? "Department Account" : "My Account"} aria-current={pathname === `/${role}/account` ? "page" : undefined} className={`flex size-10 items-center justify-center rounded-panel border border-border ${pathname === `/${role}/account` ? "bg-primary-soft text-primary" : "bg-surface-soft text-text-secondary hover:border-primary-border hover:text-primary"}`}>
            <Icon name="account" />
          </Link>
        </div>
      </header>
      <div className={fullPageChat ? "flex min-h-0 flex-1" : "flex"}>
      {collapsed && <button ref={openButton} type="button" onClick={toggleDesktop} aria-expanded={false} aria-controls="workspace-sidebar" aria-label="Open Sidebar" title="Open Sidebar" className="fixed top-[100px] left-1 z-30 hidden size-8 place-items-center rounded-full border border-border bg-surface text-text-secondary shadow-sm hover:border-primary-border hover:text-primary min-[761px]:grid"><Icon name="chevron" className="size-4 rotate-180" /></button>}
      <button type="button" onClick={() => setMobileOpen(true)} aria-label="Open Menu" aria-expanded={mobileOpen} aria-controls="workspace-sidebar" className="fixed top-[100px] left-1 z-30 grid size-8 place-items-center rounded-full border border-border bg-surface text-text-secondary shadow-sm hover:text-primary min-[761px]:hidden"><Icon name="chevron" className="size-4 rotate-180" /></button>
      {mobileOpen && <div className="fixed inset-0 z-40 bg-foreground/40 backdrop-blur-[2px] min-[761px]:hidden" aria-hidden="true" onClick={closeMobile} />}
      <aside ref={drawer} id="workspace-sidebar" aria-label={`${roleLabel} workspace menu`} className={`fixed inset-y-0 left-0 z-50 flex h-dvh w-64 shrink-0 flex-col border-r border-border bg-surface transition-[width,transform,visibility] duration-200 motion-reduce:transition-none min-[761px]:sticky min-[761px]:top-[76px] min-[761px]:h-[calc(100dvh-76px)] min-[761px]:z-20 min-[761px]:visible min-[761px]:translate-x-0 min-[761px]:self-start ${mobileOpen ? "visible translate-x-0" : "invisible -translate-x-full"} ${collapsed ? "min-[761px]:hidden" : "min-[761px]:w-64"}`}>
        <div className="flex shrink-0 items-center justify-between border-b border-border px-5 py-4 min-[761px]:hidden">
          <span className="text-sm font-semibold">{roleLabel} workspace</span>
          <button ref={closeButton} type="button" onClick={closeMobile} aria-label="Close Menu" className="grid size-8 place-items-center rounded-control text-text-secondary hover:bg-surface-hover"><Icon name="close" /></button>
        </div>
        <button type="button" onClick={toggleDesktop} aria-expanded={!collapsed} aria-controls="workspace-navigation" aria-label={collapsed ? "Expand Sidebar" : "Collapse Sidebar"} title={collapsed ? "Expand Sidebar" : "Collapse Sidebar"} className="absolute top-6 -right-4 z-30 hidden size-8 place-items-center rounded-full border border-border bg-surface text-text-secondary shadow-sm hover:border-primary-border hover:text-primary min-[761px]:grid"><Icon name="chevron" className={`size-4 transition-transform motion-reduce:transition-none ${collapsed ? "rotate-180" : ""}`} /></button>
        <div className={`min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-4 py-7 `}>
          <p className={`mb-3 px-3 text-[13px] leading-relaxed font-semibold tracking-[1.7px] text-text-muted ${hideLabel}`}>WORKSPACE</p>
          <nav id="workspace-navigation" aria-label={`${roleLabel} navigation`} className="grid gap-1.5">{links.map(link => {
            const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
            return <Link key={link.href} href={link.href} aria-label={link.label} title={collapsed ? link.label : undefined} aria-current={active ? "page" : undefined} onClick={() => setMobileOpen(false)} className={`flex min-h-11 items-center gap-3 rounded-control px-3 py-3 text-sm font-medium transition-colors ${active ? "bg-primary-soft text-primary" : "text-text-secondary hover:bg-surface-hover hover:text-primary"} `}><Icon name={link.icon} className="size-5 shrink-0" /><span className={`whitespace-nowrap capitalize ${hideLabel}`}>{link.label}</span>{link.chat && <ChatUnreadBadge />}</Link>;
          })}</nav>
        </div>
        <footer className={`shrink-0 border-t border-border p-4 `}><SignOutButton /></footer>
      </aside>
      <main className={fullPageChat ? "min-h-0 min-w-0 flex-1 overflow-hidden" : "min-w-0 flex-1"}>
        {children}
      </main>
      </div>
    </div></NotificationProvider>
  );
}
