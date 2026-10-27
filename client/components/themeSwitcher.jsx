"use client";

import { useSyncExternalStore } from "react";

const storageKey = "synoria.theme";

function subscribe(onChange) {
  function onStorage(event) {
    if (event.key !== storageKey && event.key !== null) return;
    document.documentElement.dataset.theme = event.newValue === "dark" ? "dark" : "light";
    onChange();
  }
  window.addEventListener("synoria-theme-change", onChange);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener("synoria-theme-change", onChange);
    window.removeEventListener("storage", onStorage);
  };
}

export default function ThemeSwitcher() {
  const dark = useSyncExternalStore(subscribe, () => document.documentElement.dataset.theme === "dark", () => false);

  function toggleTheme() {
    const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem(storageKey, next); } catch {}
    window.dispatchEvent(new Event("synoria-theme-change"));
  }

  const label = dark ? "Switch To Light Theme" : "Switch To Dark Theme";
  return (
    <button type="button" onClick={toggleTheme} aria-label={label} title={label} aria-pressed={dark} className="grid size-10 shrink-0 place-items-center rounded-panel border border-border bg-surface-soft text-text-secondary transition-colors hover:border-primary-border hover:bg-primary-soft hover:text-primary motion-reduce:transition-none">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="size-5" aria-hidden="true">
        {dark ? <><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M2 12h2m16 0h2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42" /></> : <path d="M20.9 13a9 9 0 0 1-9.9-9.9A9 9 0 1 0 20.9 13Z" />}
      </svg>
    </button>
  );
}
