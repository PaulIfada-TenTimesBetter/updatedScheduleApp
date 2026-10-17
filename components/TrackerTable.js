'use client';

import { useMemo, useState } from 'react';
import { PRIORITY } from '@/lib/priority';
import {
  clampWeight,
  clampProgress,
  getTotalImportance,
  getContribution,
  getOverallPerformance,
  formatPercent,
} from '@/lib/weightedProgress';
import QuickSetTable from './QuickSetTable';

const bareInput =
  'w-full rounded border border-transparent hover:border-slate-300 dark:hover:border-slate-600 bg-transparent hover:bg-white dark:hover:bg-slate-800 px-2 py-1.5 text-sm focus:outline-none focus:border-indigo-500 text-slate-900 dark:text-slate-100 placeholder:text-slate-300 dark:placeholder:text-slate-600';



/**
 * Progress Tracker — overall performance, progress bars and the importance/
 * progress editor. All math (overall %, contribution points, bars) updates
 * LIVE while typing, from a local mirror. The inputs themselves are
 * uncontrolled and only SAVE on blur/Enter, so server responses can never
 * clobber what the user typed (no snap-back).
 */
export default function TrackerTable({
  tasks,
  title,
  headerLabel,
  onHeaderLabelChange,
  onPatchTask,
  onDeleteTask,
}) {
  const displayHeader = (headerLabel || '').trim() || title || 'Task';
  const [showQuickSet, setShowQuickSet] = useState(true);
  // Live display mirror: { [taskId]: { weight?: raw, progress?: raw } } —
  // used ONLY for on-screen math while typing. Cleared on commit.
  const [live, setLive] = useState({});

  function liveVal(t, field) {
    const v = live[t.id]?.[field];
    return v === undefined ? t[field] : v;
  }

  function onType(taskId, field, raw) {
    setLive((prev) => ({
      ...prev,
      [taskId]: { ...(prev[taskId] || {}), [field]: raw },
    }));
  }

  function onCommit(taskId, field, raw) {
    const value =
      field === 'weight' ? clampWeight(raw) : clampProgress(raw);
    const committed = Number(tasks.find((t) => t.id === taskId)?.[field]);
    if (committed !== value) {
      onPatchTask(taskId, { [field]: value });
    }
    // Server truth takes over the display again.
    setLive((prev) => {
      const copy = { ...prev };
      if (copy[taskId]) {
        const next = { ...copy[taskId] };
        delete next[field];
        if (Object.keys(next).length) copy[taskId] = next;
        else delete copy[taskId];
      }
      return copy;
    });
  }

  // Live view of the tasks for ALL on-screen math (overall, bars).
  const viewTasks = useMemo(
    () =>
      tasks.map((t) => ({
        ...t,
        weight: clampWeight(Number(liveVal(t, 'weight'))),
        progress: clampProgress(Number(liveVal(t, 'progress'))),
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tasks, live]
  );

  // ⭐ All figures come from the ONE shared math module (lib/weightedProgress.js).
  const totalImportance = getTotalImportance(viewTasks);
  const weighted = getOverallPerformance(viewTasks); // exact — contributions sum to this
  if (process.env.NODE_ENV !== 'production') {
    const sumOfContributions = viewTasks.reduce(
      (s, t) => s + getContribution(t, totalImportance),
      0
    );
    console.assert(
      Math.abs(sumOfContributions - weighted) < 0.01,
      'TT math mismatch: contributions do not sum to overall!'
    );
  }

  return (
    <div className="space-y-5">
      {/* Overall performance — live */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-5 py-4 flex flex-wrap items-center gap-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Overall project performance
          </p>
          <p className="text-3xl font-black mt-0.5">
            <span
              className={
                weighted >= 70
                  ? 'text-emerald-600'
                  : weighted >= 40
                    ? 'text-amber-500'
                    : 'text-red-500'
              }
            >
              {formatPercent(weighted)}%
            </span>
            <span className="ml-2 text-[11px] font-semibold text-slate-400">
              (live — saves when you click away)
            </span>
          </p>
        </div>
        <div className="flex-1 min-w-[200px]">
          <div className="h-4 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-emerald-500 transition-all"
              style={{ width: `${weighted}%` }}
            />
          </div>
          <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
            <code className="font-mono text-[10.5px]">
              overall = Σ (progress × importance) ÷ Σ importance
            </code>{' '}
            — importance runs on a fixed 1–10 scale: a task with importance 10 at 90% adds
            ~81.8 pts; importance 1 at 100% adds ~9.1 pts. Priority never changes this number.
          </p>
        </div>
      </div>

      {/* Main table — live bars */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden">
        <div className="gantt-scroll overflow-x-auto">
          <table className="w-full text-sm" style={{ minWidth: 780 }}>
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800 text-left text-[11px] font-bold uppercase tracking-wider text-slate-400">
                <th className="px-3 py-3 w-14">S/N</th>
                <th className="px-3 py-2" style={{ minWidth: 220 }}>
                  <input
                    type="text"
                    value={headerLabel}
                    maxLength={120}
                    placeholder={title || 'Task'}
                    onChange={(e) => onHeaderLabelChange(e.target.value)}
                    title="Click to edit this heading"
                    className="w-full min-w-[180px] bg-transparent border border-transparent hover:border-slate-300 dark:hover:border-slate-600 focus:border-indigo-500 rounded px-2 py-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 focus:outline-none"
                    aria-label="Edit table heading"
                  />
                </th>
                <th className="px-3 py-3" style={{ minWidth: 220 }}>Progress</th>
                <th className="px-3 py-3" style={{ minWidth: 260 }}>Progress Status</th>
                <th className="px-3 py-3 w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {viewTasks.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-500 dark:text-slate-400">
                    No tasks yet — add them in the 📅 Scheduler tab, then track progress here.
                  </td>
                </tr>
              )}
              {viewTasks.map((t, i) => {
                const p = PRIORITY[t.priority] || PRIORITY.normal;
                const prog = Math.max(0, Math.min(100, t.progress || 0));
                return (
                  <tr key={t.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="px-3 py-2.5 text-slate-400">{i + 1}</td>
                    <td className="px-3 py-2.5">
                      <p className="font-medium text-slate-800 dark:text-slate-100 truncate max-w-[280px]">
                        {t.name}
                      </p>
                      <span
                        className={`mt-1 inline-block text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded ${p.badge}`}
                      >
                        {p.label}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <div
                        className="h-7 rounded-md overflow-hidden ring-1 ring-black/10 relative max-w-[320px]"
                        style={{ backgroundColor: p.bar }}
                      >
                        <div
                          className="h-full transition-all"
                          style={{ width: `${prog}%`, backgroundColor: p.fill }}
                        />
                        <span className="absolute inset-0 flex items-center justify-center text-[11px] font-bold text-white drop-shadow-sm">
                          {prog}%
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <input
                        type="text"
                        defaultValue={t.progressStatus || ''}
                        maxLength={500}
                        placeholder="e.g. Ongoing / Awaiting mobilization…"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') e.currentTarget.blur();
                        }}
                        onBlur={(e) => {
                          const v = e.target.value.trim().slice(0, 500);
                          if ((t.progressStatus || '') !== v) {
                            onPatchTask(t.id, { progressStatus: v });
                          }
                        }}
                        className={bareInput}
                        aria-label="Progress status comment"
                      />
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <button
                        type="button"
                        onClick={() => {
                          if (window.confirm(`Delete "${t.name}"? This cannot be undone.`)) {
                            onDeleteTask(t.id);
                          }
                        }}
                        className="text-slate-300 hover:text-red-500 text-lg leading-none"
                        title="Delete task"
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Quick-set editor */}
      <div>
        <button
          type="button"
          onClick={() => setShowQuickSet((v) => !v)}
          className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 mb-2"
        >
          {showQuickSet ? '▾ Hide' : '▸ Show'} importance &amp; progress editor
        </button>
        {showQuickSet && (
          <QuickSetTable
            tasks={viewTasks}
            title={displayHeader}
            liveVal={liveVal}
            onType={onType}
            onCommit={onCommit}
          />
        )}
      </div>

      <p className="text-xs text-slate-400 text-center">
        Everything recalculates as you type and saves when you click away or press Enter. The
        higher a task&apos;s importance, the more its progress moves the overall performance.
      </p>
    </div>
  );
}
