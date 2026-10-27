"use client";
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Button from '@/components/button';

export default function StudentChatEntry() {
  const router = useRouter();
  const [state, setState] = useState(null), [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    async function openChat() {
      try {
        const response = await fetch('/api/chat', { cache: 'no-store', signal: controller.signal });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Unable to open your project chat.');
        if (controller.signal.aborted) return;
        const room = data.rooms[0];
        if (room) router.replace(`/student/chat/${room.workspaceId}`);
        else setState({ empty: true });
      } catch (error) {
        if (!controller.signal.aborted) setState({ error: error.message });
      }
    }
    openChat();
    return () => controller.abort();
  }, [router, attempt]);
  return <div className="flex h-full items-center justify-center bg-surface p-6"><div className="max-w-sm text-center">
    {state?.empty ? <><h1 className="text-xl font-semibold">No Active Project Yet</h1><p className="text-text-secondary">Create or join a project team to start your conversation.</p><Link href="/student/team" className="text-sm font-semibold text-primary hover:underline">Go To Team</Link></> : state?.error ? <><p role="alert" className="text-text-secondary">{state.error}</p><Button appearance="outline" onClick={() => { setState(null); setAttempt(value => value + 1); }}>Try Again</Button></> : <p role="status" className="text-text-secondary">Opening your project conversation…</p>}
  </div></div>;
}
