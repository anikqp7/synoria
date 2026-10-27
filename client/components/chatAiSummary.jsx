"use client";
import { useState } from 'react';
import Button from '@/components/button';
import Modal from '@/components/modal';

export default function ChatAiSummary() {
  const [open, setOpen] = useState(false);
  return <>
    <Button className="fixed bottom-28 right-4 z-30 gap-2 shadow-lg sm:right-6 xl:bottom-6" onClick={() => setOpen(true)} aria-haspopup="dialog">
      <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="size-4"><path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3Z M20 2v4M18 4h4" /></svg>
      AI Summary
    </Button>
    {open && <Modal title="AI Summary" onClose={() => setOpen(false)}><div className="p-6"><p className="m-0 text-sm text-text-secondary">AI summaries are not available yet.</p><div className="mt-6 flex justify-end"><Button onClick={() => setOpen(false)}>Close</Button></div></div></Modal>}
  </>;
}
