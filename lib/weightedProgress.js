/**
 * ⭐ SINGLE SOURCE OF TRUTH for all weighted-progress math.
 *
 * Every calculation anywhere in the app (Overall %, per-task Contribution,
 * progress bars, PNG/PDF exports) MUST pull from these functions — never
 * re-implement the formula locally.
 *
 *   totalImportance      = Σ importance_i            (all tasks, fresh every call)
 *   contribution_i       = importance_i × progress_i ÷ totalImportance
 *   overallPerformance   = Σ contribution_i          (= Σ importance×progress ÷ totalImportance)
 *
 * Properties guaranteed by construction:
 *   • works for ANY task count (1 … ∞) — no hardcoded N anywhere;
 *   • total importance is recomputed fresh on every call from the task list
 *     handed in, so edits/additions/deletions can never leave it stale;
 *   • contributions always sum EXACTLY to the overall performance.
 */

export function clampWeight(v) {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n)) return 1;
  return Math.max(1, Math.min(100, n));
}

export function clampProgress(v) {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, n));
}

/** The one and only denominator. Always derived from the CURRENT task list. */
export function getTotalImportance(tasks) {
  return (tasks || []).reduce((sum, t) => sum + clampWeight(t && t.weight), 0);
}

/** One task's share of the overall, in points (all tasks' points sum to 100). */
export function getContribution(task, totalImportance) {
  if (!totalImportance) return 0;
  const w = clampWeight(task && task.weight);
  const p = clampProgress(task && task.progress);
  return (w * p) / totalImportance;
}

/** Overall performance = Σ contributions. Computed from ONE shared total. */
export function getOverallPerformance(tasks) {
  const total = getTotalImportance(tasks);
  return (tasks || []).reduce((sum, t) => sum + getContribution(t, total), 0);
}

/**
 * Display formatter so on-screen / on-PDF numbers visibly reconcile:
 * whole when the value is within 0.05 of an integer, else 1 decimal.
 */
export function formatPercent(x) {
  const n = Number(x) || 0;
  return Math.abs(n - Math.round(n)) < 0.05 ? String(Math.round(n)) : n.toFixed(1);
}
