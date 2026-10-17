'use client';

import { useMemo, useState } from 'react';
import { PRIORITY } from '@/lib/priority';
import QuickSetTable from './QuickSetTable';

const bareInput =
  'w-full rounded border border-transparent hover:border-slate-300 dark:hover:border-slate-600 bg-transparent hover:bg-white dark:hover:bg-slate-800 px-2 py-1.5 text-sm focus:outline-none focus:border-indigo-500 text-slate-900 dark:text-slate-100 placeholder:text-slate-300 dark:placeholder:text-slate-600';

function clampWeight(v) {
  return Math.max(1, Math.min(100, Math.round(Number(v) || 1)));
}

/**
 * Progress Tracker — main table: S/N, task, progress bar (%) and progress
 * status, followed by the quick-set editor where Importance and Progress %
 * are entered. All inputs are uncontrolled (defaultValue) and commit on
 * blur/Enter, so server responses can never clobber what the user typed.
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

  const totalWeight = useMemo(
    () => tasks.reduce((s, t) => s + clampWeight(t.weight), 0),
    [tasks]
  );
  const weighted = totalWeight
    ? Math.round(
        tasks.reduce((s, t) => s + (t.progress || 0) * clampWeight(t.weight), 0) / totalWeight
      )
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
          <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
            Every figure you enter counts:{' '}
            <code className="font-mono text-[10.5px]">
              overall = Σ (progress × importance) ÷ Σ importance
            </code>
            . Priority never changes this number — it only colors the bars.
          </p>
        </div>
      </div>

      {/* Main table */}
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
              {tasks.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-500 dark:text-slate-400">
                    No tasks yet — add them in the 📅 Scheduler tab, then track progress here.
                  </td>
                </tr>
              )}
              {tasks.map((t, i) => {
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
          <QuickSetTable tasks={tasks} title={displayHeader} onPatchTask={onPatchTask} />
        )}
      </div>

      <p className="text-xs text-slate-400 text-center">
        Edits save when you click away or press Enter. The higher a task&apos;s importance, the
        more its progress moves the overall performance.
      </p>
    </div>
  );
}
