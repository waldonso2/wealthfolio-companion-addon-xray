// PLACEHOLDER example logic, kept apart from the components so tests and the performance report call it directly.
export function wordCounts(text: string): [string, number][] {
  const counts = new Map<string, number>();
  for (const raw of text.split(/\s+/)) {
    const word = raw.replace(/^[.,;:!?"'()]+|[.,;:!?"'()]+$/g, "").toLowerCase();
    if (word) counts.set(word, (counts.get(word) ?? 0) + 1);
  }
  return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}
