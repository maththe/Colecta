export function matchesSearch(fields: (string | null | undefined)[], query?: string): boolean {
  if (!query || query.trim() === '') return true;
  const q = query.toLowerCase().trim();
  return fields.some((f) => f && f.toLowerCase().includes(q));
}
