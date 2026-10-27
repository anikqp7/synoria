"use client";
import { Input, useFormValidation } from '@/components/validatedForm';

import { useEffect, useRef, useState } from "react";
import { researchInterestTags, validateResearchInterests } from "@/lib/researchInterests";

export default function TagInput({ id, name, defaultValue = "" }) {
  const [tags, setTags] = useState(() => researchInterestTags(defaultValue));
  const [draft, setDraft] = useState("");
  const inputRef = useRef(null);
  const setFieldValue = useFormValidation()?.setFieldValue;
  const pendingTags = researchInterestTags([...tags, ...researchInterestTags(draft)]);
  const tagValue = pendingTags.join(", ");
  useEffect(() => { setFieldValue?.(name, tagValue); }, [setFieldValue, name, tagValue]);

  function commit(value = draft) {
    const next = researchInterestTags([...tags, ...researchInterestTags(value)]);
    const message = validateResearchInterests(next);
    inputRef.current?.setCustomValidity(message);
    if (message) return;
    setTags(next);
    setDraft("");
  }

  function remove(index) {
    const next = tags.filter((_, tagIndex) => tagIndex !== index);
    setTags(next);
    const message = validateResearchInterests(researchInterestTags([...next, ...researchInterestTags(draft)]));
    inputRef.current?.setCustomValidity(message);
    inputRef.current?.focus();
  }

  return (
    <div>
      <Input type="hidden" name={name} value={tagValue} />
      <div className="rounded-control border border-border bg-surface-soft p-3 transition-colors focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20">
        {tags.length > 0 && <ul aria-label="Added research interests" className="m-0 mb-2 flex list-none flex-wrap gap-2 p-0">{tags.map((tag, index) => <li key={tag.toLowerCase()} className="flex max-w-full items-center gap-1.5 rounded-control border border-primary-border bg-primary-soft py-1 pr-1 pl-2.5 text-[13px] leading-relaxed text-primary"><span className="min-w-0 [overflow-wrap:anywhere]">{tag}</span><button type="button" onClick={() => remove(index)} aria-label={`Remove ${tag}`} className="grid size-6 shrink-0 place-items-center rounded-control hover:bg-primary/15 disabled:cursor-not-allowed disabled:opacity-50"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className="size-3.5" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg></button></li>)}</ul>}
        <Input ref={inputRef} id={id} value={draft} aria-describedby={`${id}-hint`} placeholder={tags.length ? "Add another interest…" : "e.g. Machine learning"} className="[&]:h-9 [&]:border-0 [&]:bg-transparent [&]:px-1 [&]:shadow-none [&]:outline-none" onChange={event => {
          const value = event.target.value;
          setDraft(value);
          const message = validateResearchInterests(researchInterestTags([...tags, ...researchInterestTags(value)]));
                event.target.setCustomValidity(message);
        }} onKeyDown={event => {
          if (event.nativeEvent.isComposing) return;
          if (event.key === "Enter" || event.key === ",") { event.preventDefault(); commit(); }
          if (event.key === "Backspace" && !draft && tags.length) { event.preventDefault(); remove(tags.length - 1); }
        }} onBlur={() => commit()} onPaste={event => {
          const pasted = event.clipboardData.getData("text");
          if (/[,;\n]/.test(pasted)) { event.preventDefault(); commit(draft + pasted); }
        }} />
      </div>
      <p id={`${id}-hint`} className="mt-2 mb-0 text-[13px] leading-relaxed text-text-muted">Press Enter or comma to add a tag. Up to 10 interests.</p>
    </div>
  );
}
