export function notifyChatChanged() {
  window.dispatchEvent(new Event('synoria.chatChanged'));
  try { localStorage.setItem('synoria.chatChanged', `${Date.now()}-${Math.random()}`); } catch {}
}
