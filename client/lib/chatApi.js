export function chatQuery(resource, request) {
  const source = new URL(request.url).searchParams;
  const query = new URLSearchParams();
  for (const key of ['before', 'after', 'timeline', 'timelineBefore', 'timelineAfter']) if (source.has(key)) query.set(key, source.get(key));
  return `${resource}${query.size ? `?${query}` : ''}`;
}
