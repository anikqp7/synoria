export function researchInterestTags(value) {
  const values = Array.isArray(value) ? value : String(value || "").split(/[,;\n]/);
  const seen = new Set();
  return values.map(tag => String(tag).trim()).filter(tag => {
    const key = tag.toLowerCase();
    if (!tag || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function validateResearchInterests(tags) {
  if (tags.length > 10) return "Add up to 10 research interests.";
  if (tags.some(tag => tag.length > 50)) return "Each research interest must be 50 characters or fewer.";
  if (tags.join(", ").length > 500) return "Research interests must total 500 characters or fewer.";
  return "";
}
