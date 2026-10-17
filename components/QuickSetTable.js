'use client';

import { useEffect, useMemo, useState } from 'react';
import { PRIORITY } from '@/lib/priority';

const inputBase =
  'rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500';

function clampWeight(v) {
  return Math.max(1, Math.min(100, Math.round(Number(v) || 1)));
}
function clampProgress(v) {
  const n = Math.round(Number(v));
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(100, n));
}

/**
 * Quick-set editor: S/N, task, Importance, Progress (%), and a live
 * "Contribution" readout so the math is visible:
 *   contribution = progress × importance ÷ total importance
 * The contributions of all tasks sum exactly to the overall performance.
 * Inputs are uncontrolled (defaultValue) and commit on blur/Enter.
 */
export default function QuickSetTable({ tasks, title, onPatchTask }) {
  const displayHeader = title || 'Task';

  const totalWeight = useMemo(
    () => tasks.reduce((s, t) => s + clampWeight(t.weight), 0),
    [tasks]
  );

  function contribution(t) {
    if (!totalWeight) return 0;
    return ((t.progress || 0) * clampWeight(t.weight)) / totalWeight;
  }

  function commitNumber(t, field, raw, clamp) {
    const value = clamp(raw);
    if (Number(t[field]) === value) return;
    onPatchTask(t.id, { [field]: value });
  }

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden">
      <div className="bg-slate-50 dark:bg-slate-800 px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">
        Importance &amp; progress — edit a box, then click away (or press Enter) to save
      </div>
      <div className="gantt-scroll overflow-x-auto">
        <table className="w-full text-sm" style={{ minWidth: 760 }}>
          <thead>
            <tr className="text-left text-[11px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 dark:border-slate-800">
              <th className="px-3 py-2.5 w-14">S/N</th>
              <th className="px-3 py-2.5">{displayHeader}</th>
              <th className="px-3 py-2.5 w-32 text-center">Importance</th>
              <th className="px-3 py-2.5 w-32">Progress (%)</th>
              <th className="px-3 py-2.5 w-32">Contribution</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {tasks.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-slate-400 text-sm">
                  Nothing to set yet — add tasks in the 📅 Scheduler tab first.
                </td>
              </tr>
            )}
            {tasks.map((t, i) => (
              <tr key={t.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                <td className="px-3 py-2 text-slate-400">{i + 1}</td>
                <td className="px-3 py-2 text-slate-700 dark:text-slate-200 truncate max-w-[280px]">
                  {t.name}
                </td>
                <td className="px-3 py-2 text-center">
                  <input
                    type="number"
                    min="1"
                    max="100"
                    defaultValue={String(t.weight ?? 1)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') e.currentTarget.blur();
                    }}
                    onBlur={(e) => commitNumber(t, 'weight', e.target.value, clampWeight)}
                    title="Importance of this task to the project: 1 = minor, 5 = major, 10+ = critical path"
                    className={`${inputBase} w-16 text-center`}
                    aria-label={`Importance weight for ${t.name}`}
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="5"
                    defaultValue={String(t.progress ?? 0)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') e.currentTarget.blur();
                    }}
                    onBlur={(e) => commitNumber(t, 'progress', e.target.value, clampProgress)}
                    className={`${inputBase} w-20 text-center`}
                    aria-label={`Progress percentage for ${t.name}`}
                  />
                </td>
                <td className="px-3 py-2 text-slate-500 dark:text-slate-400">
                  <span className="inline-block w-20 text-center rounded bg-slate-100 dark:bg-slate-800 px-2 py-1.5 text-xs font-semibold">
                    {contribution(t).toFixed(1)} pts
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="px-4 py-2.5 text-[11px] text-slate-400 border-t border-slate-100 dark:border-slate-800">
        <span className="font-semibold text-slate-500 dark:text-slate-300">
          How the overall is computed:
        </span>{' '}
        each task contributes{' '}
        <code className="font-mono text-[10.5px]">progress × importance ÷ total importance</code>{' '}
        — so a figure of <strong>7</strong> makes that task&apos;s progress count 7× more than a
        figure of 1. The contributions of all tasks add up to the overall performance.
        Importance = how much the task matters: <strong>1</strong> minor · <strong>3</strong>{' '}
        useful · <strong>5</strong> major · <strong>8+</strong> critical path.
      </div>
    </div>
  );
}
