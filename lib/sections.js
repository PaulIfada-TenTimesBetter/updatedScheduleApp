/**
 * Group tasks into sections for display, preserving first-appearance order.
 * - If NO task has a section, returns one group with `section: null` (flat list).
 * - Otherwise, unsectioned tasks appear first under a "General" header, then
 *   each named section in the order it first appears.
 */
export function groupTasksBySection(tasks) {
  const named = [];
  const seen = new Set();
  for (const t of tasks) {
    const s = (t.section || '').trim();
    if (s && !seen.has(s)) {
      seen.add(s);
      named.push(s);
    }
  }
  if (!named.length) return [{ section: null, tasks }];

  const groups = [];
  const general = tasks.filter((t) => !(t.section || '').trim());
  if (general.length) groups.push({ section: 'General', tasks: general });
  for (const s of named) {
    groups.push({ section: s, tasks: tasks.filter((t) => (t.section || '').trim() === s) });
  }
  return groups;
}

/** Unique section names, in first-appearance order. */
export function uniqueSectionNames(tasks) {
  const out = [];
  const seen = new Set();
  for (const t of tasks) {
    const s = (t.section || '').trim();
    if (s && !seen.has(s)) {
      seen.add(s);
      out.push(s);
    }
  }
  return out;
}
