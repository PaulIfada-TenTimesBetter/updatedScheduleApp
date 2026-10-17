'use client';

import {
  clampWeight,
  clampProgress,
  getTotalImportance,
  getContribution,
} from '@/lib/weightedProgress';

const inputBase =
  'rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500';



/**
 * Quick-set editor: S/N, task, Importance, Progress (%), and a LIVE
 * "Contribution" column that updates while you type:
 *   contribution = progress × importance ÷ total importance
 * Inputs themselves are uncontrolled (defaultValue) and only SAVE on
 * blur/Enter — so live math can never cause the snap-back bug.
 */
export default function QuickSetTable({ tasks, title, liveVal, onType, onCommit }) {
  const displayHeader = title || 'Task';

  const clampFor = {
    weight: clampWeight,
    progress: clampProgress,
  };

  // ⭐ Same shared denominator as the Overall card — tasks arrive from the
  // tracker with live-typed values already resolved and clamped.
  const totalImportance = getTotalImportance(tasks);

  function contribution(t) {
    return getContribution(t, totalImportance);
  }

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden">
      <div className="bg-slate-50 dark:bg-slate-800 px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">
        Importance &amp; progress — the Contribution column updates as you type; click away to save
      </div>
      <div className="gantt-scroll overflow-x-auto">
        <table className="w-full text-sm" style={{ minWidth: 780 }}>
          <thead>
            <tr className="text-left text-[11px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 dark:border-slate-800">
              <th className="px-3 py-2.5 w-14">S/N</th>
              <th className="px-3 py-2.5">{displayHeader}</th>
              <th className="px-3 py-2.5 w-32 text-center">Importance</th>
              <th className="px-3 py-2.5 w-32">Progress (%)</th>
              <th className="px-3 py-2.5 w-36">Contribution</th>
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
                    defaultValue={String(liveVal(t, 'weight') ?? 1)}
                    onChange={(e) => onType(t.id, 'weight', e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') e.currentTarget.blur();
                    }}
                    onBlur={(e) => onCommit(t.id, 'weight', e.target.value)}
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
                    defaultValue={String(liveVal(t, 'progress') ?? 0)}
                    onChange={(e) => onType(t.id, 'progress', e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') e.currentTarget.blur();
                    }}
                    onBlur={(e) => onCommit(t.id, 'progress', e.target.value)}
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
          How it works:
        </span>{' '}
        each task adds{' '}
        <code className="font-mono text-[10.5px]">progress × importance ÷ total importance</code>{' '}
        points, and all points sum to the overall performance. Example: importance{' '}
        <strong>85</strong> at 90% adds ~88.9 pts, while importance <strong>1</strong> at 100%
        adds ~1.2 pts — the important task dominates, exactly as it should.
      </div>
    </div>
  );
}
