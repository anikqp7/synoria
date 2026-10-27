"use client";

import { useEffect, useId, useRef } from "react";

export default function Modal({ title, description, onClose, busy = false, children, className = "" }) {
  const dialogRef = useRef(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    const previousOverflow = document.body.style.overflow;
    dialog.showModal();
    document.body.style.overflow = "hidden";
    dialog.querySelector('input:not([disabled])')?.focus();
    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  function closeOnBackdrop(event) {
    if (busy || event.target !== event.currentTarget) return;
    const rect = event.currentTarget.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) onClose();
  }

  return (
    <dialog ref={dialogRef} aria-labelledby={titleId} aria-describedby={description ? descriptionId : undefined} aria-busy={busy} onCancel={event => { event.preventDefault(); if (!busy) onClose(); }} onClick={closeOnBackdrop} className={`fixed inset-0 m-auto max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-2xl overflow-y-auto overscroll-contain rounded-panel border border-border bg-surface p-0 text-foreground shadow-2xl backdrop:bg-black/60 backdrop:backdrop-blur-sm ${className}`}>
      <header className="sticky top-0 z-10 flex shrink-0 items-start justify-between gap-4 border-b border-border bg-surface px-6 py-5">
        <div><h2 id={titleId} className="m-0 text-xl font-semibold tracking-[-.5px]">{title}</h2>{description && <p id={descriptionId} className="mt-2 mb-0 text-sm leading-relaxed text-text-muted">{description}</p>}</div>
        <button type="button" onClick={onClose} disabled={busy} aria-label="Close Dialog" className="grid size-8 shrink-0 place-items-center rounded-control text-text-secondary hover:bg-surface-hover disabled:cursor-not-allowed disabled:text-disabled-text"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" className="size-5" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg></button>
      </header>
      {children}
    </dialog>
  );
}
