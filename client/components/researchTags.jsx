import { researchInterestTags } from "@/lib/researchInterests";

export default function ResearchTags({ value }) {
  const tags = researchInterestTags(value);
  if (!tags.length) return null;
  return <ul aria-label="Research interests" className="m-0 mt-2 flex list-none flex-wrap gap-2 p-0">{tags.map(tag => <li key={tag.toLowerCase()} className="max-w-full rounded-control border border-primary-border bg-primary-soft px-2.5 py-1 text-[13px] leading-relaxed text-primary [overflow-wrap:anywhere]">{tag}</li>)}</ul>;
}
