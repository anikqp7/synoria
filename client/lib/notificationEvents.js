"use client";
export const notificationEvent = 'synoria.notificationsChanged';
export function notificationsChanged() {
  window.dispatchEvent(new Event(notificationEvent));
  try { localStorage.setItem(notificationEvent, String(Date.now())); } catch {}
}
export const categoryLabels = { account: 'Account', team: 'Team', proposal: 'Proposal', resources: 'Resources', supervision: 'Supervision',    chat: 'Chat', meeting: 'Meetings',   defence: 'Defence', evaluation: 'Evaluation', result: 'Result', reminder: 'Reminder' };
