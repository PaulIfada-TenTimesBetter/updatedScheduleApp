'use client';

import { useEffect, useRef, useState } from 'react';
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
 * Progress Tracker — no dates here. Main table: progress bar (%) + progress
 * status. Under it, a quick-set table for editing weight and the progress
 * percentage of each task directly.
 */
export default function TrackerTable({ tasks, title, onPatchTask, onDeleteTask }) {
  const [rows, setRows] = useState(tasks);
  const timers = useRef({});

  useEffect(() => {
    setRows(tasks);
  }, [tasks]);

  function localUpdate(id, fields) {
    setRows((prev) => prev.map((t) => (t.id === id ? { ...t, ...fields } : t)));
  }

  /** Debounced save so typing doesn't fire a request per keypress. */
  function queuePatch(id, fields, delay = 600) {
    localUpdate(id, fields);
    clearTimeout(timers.current[id + (fields.weight !== undefined ? 'w' : fields.progress !== undefined ? 'p' : 's')]);
    const key = id + (fields.weight !== undefined ? 'w' : fields.progress !== undefined ? 'p' : 's');
    timers.current[key] = setTimeout(() => onPatchTask(id, fields), delay);
  }

  const totalWeight = rows.reduce((s, t) => s + clampWeight(t.weight), 0);
  const weighted = totalWeight
    ? Math.round(rows.reduce((s, t) => s + (t.progress || 0) * clampWeight(t.weight), 0) / totalWeight)
    : 0;

  return (
    <div className="space-y-5">
      {/* Overall performance */}
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
              {weighted}%
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
          <p className="mt-1.5 text-xs text-slate-400">
            Weighted average across {rows.length} task{rows.length === 1 ? '' : 's'}
          </p>
        </div>
      </div>

      {/* Main table: progress bar + status only */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden">
        <div className="gantt-scroll overflow-x-auto">
          <table className="w-full text-sm" style={{ minWidth: 760 }}>
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800 text-left text-[11px] font-bold uppercase tracking-wider text-slate-400">
                <th className="px-3 py-3 w-12">#</th>
                <th className="px-3 py-3">{title || 'Task'}</th>
                <th className="px-3 py-3" style={{ minWidth: 220 }}>Progress</th>
                <th className="px-3 py-3" style={{ minWidth: 260 }}>Progress Status</th>
                <th className="px-3 py-3 w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-500 dark:text-slate-400">
                    No tasks yet — add them in the 📅 Scheduler tab, then track progress here.
                  </td>
                </tr>
              )}
              {rows.map((t, i) => {
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
                        value={t.progressStatus || ''}
                        maxLength={500}
                        placeholder="e.g. Ongoing / Awaiting mobilization…"
                        onChange={(e) => queuePatch(t.id, { progressStatus: e.target.value })}
                        className={`${inputBase} w-full border-transparent hover:border-slate-300 dark:hover:border-slate-600 bg-transparent hover:bg-white dark:hover:bg-slate-800`}
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

      {/* Quick-set table: weight + progress inputs */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden">
        <div className="bg-slate-50 dark:bg-slate-800 px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">
          Set weight &amp; progress — type a value, it saves automatically
        </div>
        <div className="gantt-scroll overflow-x-auto">
          <table className="w-full text-sm" style={{ minWidth: 640 }}>
            <thead>
              <tr className="text-left text-[11px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 dark:border-slate-800">
                <th className="px-3 py-2.5 w-12">#</th>
                <th className="px-3 py-2.5">{title || 'Task'}</th>
                <th className="px-3 py-2.5 w-28 text-center">Weight</th>
                <th className="px-3 py-2.5 w-36">Progress (%)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {rows.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-slate-400 text-sm">
                    Nothing to set yet.
                  </td>
                </tr>
              )}
              {rows.map((t, i) => (
                <tr key={t.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                  <td className="px-3 py-2 text-slate-400">{i + 1}</td>
                  <td className="px-3 py-2 text-slate-700 dark:text-slate-200 truncate max-w-[320px]">
                    {t.name}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={t.weight ?? 1}
                      onChange={(e) =>
                        queuePatch(t.id, { weight: e.target.value === '' ? '' : Number(e.target.value) })
                      }
                      onBlur={(e) => {
                        const w = clampWeight(e.target.value);
                        localUpdate(t.id, { weight: w });
                        onPatchTask(t.id, { weight: w });
                      }}
                      className={`${inputBase} w-16 text-center`}
                      aria-label={`Weight for ${t.name}`}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="5"
                      value={t.progress ?? 0}
                      onChange={(e) => queuePatch(t.id, { progress: e.target.value === '' ? 0 : Number(e.target.value) })}
                      onBlur={(e) => {
                        const v = clampProgress(e.target.value);
                        localUpdate(t.id, { progress: v });
                        onPatchTask(t.id, { progress: v });
                      }}
                      className={`${inputBase} w-20 text-center`}
                      aria-label={`Progress percentage for ${t.name}`}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-slate-400 text-center">
        Weight controls how much each task counts toward overall performance — a task with
        weight 10 counts ten times as much as weight 1. Everything saves automatically.
      </p>
    </div>
  );
}
