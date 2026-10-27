"use client";
const key = 'thesisDesk.sidebarCollapsed';
const eventName = 'synoria.sidebarChanged';
let fallback = false;
export function sidebarSnapshot() { try { return localStorage.getItem(key) === 'true'; } catch { return fallback; } }
export function sidebarSubscribe(notify) {
  const storage = event => { if (event.key === key || event.key === null) notify(); };
  window.addEventListener(eventName, notify); window.addEventListener('storage', storage);
  return () => { window.removeEventListener(eventName, notify); window.removeEventListener('storage', storage); };
}
export function setSidebarCollapsed(value) { fallback = value; try { localStorage.setItem(key, String(value)); } catch {} window.dispatchEvent(new Event(eventName)); }
export const sidebarServerSnapshot = () => false;
