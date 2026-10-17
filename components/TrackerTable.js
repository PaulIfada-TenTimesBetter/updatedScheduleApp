'use client';

import { useEffect, useRef, useState } from 'react';
import { PRIORITY } from '@/lib/priority';

const inputBase =
  'rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500';

/**
 * Progress Tracker — no dates, just each activity with its progress bar (%),
 * an editable weight, and a "Progress Status" comment column. Weights drive
 * the weighted overall performance.
 */
export default function TrackerTable({ tasks, title, onPatchTask, onDeleteTask, loadError }) {
  const [rows, setRows] = useState(tasks);
  const timers = useRef({});

  // Re-sync when the underlying task list changes identity (add/delete from elsewhere).
  useEffect(() => {
    setRows(tasks);
  }, [tasks]);

  function localUpdate(id, fields) {
    setRows((prev) => prev.map((t) => (t.id === id ? { ...t, ...fields } : t)));
  }

  /** Debounced save so typing in a comment doesn't fire a request per key. */
  function queuePatch(id, fields, delay = 600) {
    localUpdate(id, fields);
    const key = id;
    clearTimeout(timers.current[key]);
    timers.current[key] = setTimeout(() => onPatchTask(id, fields), delay);
  }

  function clampWeight(v) {
    return Math.max(1, Math.min(100, Math.round(Number(v) || 1)));
  }

  const totalWeight = rows.reduce((sum, t) => sum + clampWeight(t.weight), 0);
  const weighted = totalWeight
    ? Math.round(
        rows.reduce((sum, t) => sum + (t.progress || 0) * clampWeight(t.weight), 0) / totalWeight
      )
    : 0;

  if (loadError) {
    return (
      <div className="rounded-xl border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950 text-red-800 dark:text-red-300 text-sm px-4 py-3">
        <strong className="font-semibold">Database error.</strong> {loadError}
      </div>
    );
  }

  if (!rows.length) {
    return (
      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-6 py-14 text-center">
        <p className="text-4xl">📊</p>
        <p className="mt-3 font-semibold text-slate-700 dark:text-slate-200">
          Nothing to track yet
        </p>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Add tasks in the Scheduler tab first — then track their progress here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Overall performance */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-5 py-4 flex flex-wrap items-center gap-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Overall project performance
          </p>
          <p className="text-3xl font-black mt-0.5">
            <span className={weighted >= 70 ? 'text-emerald-600' : weighted >= 40 ? 'text-amber-500' : 'text-red-500'}>
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
            Weighted average across {rows.length} task{rows.length === 1 ? '' : 's'} · total
            weight {totalWeight}
          </p>
        </div>
      </div>

      {/* Tracker table */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden">
        <div className="gantt-scroll overflow-x-auto">
          <table className="w-full text-sm" style={{ minWidth: 860 }}>
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800 text-left text-[11px] font-bold uppercase tracking-wider text-slate-400">
                <th className="px-3 py-3 w-12">#</th>
                <th className="px-3 py-3">{title || 'Task'}</th>
                <th className="px-3 py-3 w-24 text-center">Weight</th>
                <th className="px-3 py-3" style={{ minWidth: 220 }}>Progress</th>
                <th className="px-3 py-3" style={{ minWidth: 240 }}>Progress Status</th>
                <th className="px-3 py-3 w-12"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {rows.map((t, i) => {
                const p = PRIORITY[t.priority] || PRIORITY.normal;
                const prog = Math.max(0, Math.min(100, t.progress || 0));
                return (
                  <tr key={t.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 align-middle">
                    <td className="px-3 py-2.5 text-slate-400">{i + 1}</td>
                    <td className="px-3 py-2.5">
                      <input
                        type="text"
                        value={t.name}
                        maxLength={140}
                        onChange={(e) => queuePatch(t.id, { name: e.target.value })}
                        className={`font-medium w-full min-w-[160px] ${inputBase} border-transparent hover:border-slate-300 dark:hover:border-slate-600 bg-transparent hover:bg-white dark:hover:bg-slate-800`}
                        aria-label="Task name"
                      />
                      <span className={`mt-1 inline-block text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded ${p.badge}`}>
                        {p.label}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <input
                        type="number"
                        min="1"
                        max="100"
                        value={t.weight ?? 1}
                        onChange={(e) => queuePatch(t.id, { weight: e.target.value === '' ? '' : Number(e.target.value) })}
                        onBlur={(e) => {
                          const w = clampWeight(e.target.value);
                          localUpdate(t.id, { weight: w });
                          onPatchTask(t.id, { weight: w });
                        }}
                        className={`${inputBase} w-16 text-center`}
                        aria-label="Task weight"
                      />
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-7 rounded-md overflow-hidden ring-1 ring-black/10 relative" style={{ backgroundColor: p.bar }}>
                          <div
                            className="h-full transition-all"
                            style={{ width: `${prog}%`, backgroundColor: p.fill }}
                          />
                          <span className="absolute inset-0 flex items-center justify-center text-[11px] font-bold text-white drop-shadow-sm">
                            {prog}%
                          </span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          step="5"
                          value={prog}
                          onChange={(e) => queuePatch(t.id, { progress: Number(e.target.value) }, 250)}
                          className="w-20 accent-indigo-600"
                          aria-label={`Progress for ${t.name}`}
                        />
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

      <p className="text-xs text-slate-400 text-center">
        Everything on this page saves automatically. Weight controls how much each task counts
        toward the overall performance — a task with weight 10 counts ten times as much as
        weight 1.
      </p>
    </div>
  );
}
