'use client';

import { useState } from 'react';
import { parseDate, addDays, todayISO } from '@/lib/dates';

function toISO(date) {
  return date.toISOString().slice(0, 10);
}

const PRIORITY_OPTIONS = [
  {
    value: 'normal',
    label: 'Normal',
    hint: 'Standard task',
    dot: '#3b82f6',
    active: 'border-blue-500 bg-blue-50 text-blue-700',
  },
  {
    value: 'critical',
    label: 'Critical',
    hint: 'Must not slip — shown in red',
    dot: '#ef4444',
    active: 'border-red-500 bg-red-50 text-red-700',
  },
];

export default function TaskModal({ task, busy, error, onSave, onDelete, onClose }) {
  const editing = Boolean(task);
  const [name, setName] = useState(task?.name || '');
  const [startDate, setStartDate] = useState(task?.startDate || todayISO());
  const [endDate, setEndDate] = useState(
    task?.endDate || toISO(addDays(parseDate(todayISO()), 3))
  );
  const [priority, setPriority] = useState(task?.priority || 'normal');
  const [progress, setProgress] = useState(task?.progress ?? 0);
  const [localError, setLocalError] = useState('');

  const shownError = localError || error;
  const preview = priority === 'critical' ? '#ef4444' : '#3b82f6';
  const previewFill = priority === 'critical' ? '#991b1b' : '#1e40af';

  function onSubmit(e) {
    e.preventDefault();
    setLocalError('');
    if (!name.trim()) {
      setLocalError('Please give the task a name.');
      return;
    }
    if (endDate < startDate) {
      setLocalError('End date cannot be before the start date.');
      return;
    }
    onSave({ name: name.trim(), startDate, endDate, priority, progress }, task?.id);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60"
      onMouseDown={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white shadow-2xl p-6 max-h-[92vh] overflow-auto"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <h2 className="text-lg font-bold text-slate-900">
            {editing ? 'Edit task' : 'New task'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-xl leading-none px-1"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <form onSubmit={onSubmit} className="mt-4 space-y-4">
          {shownError && (
            <p className="rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2">
              {shownError}
            </p>
          )}

          <div>
            <label htmlFor="task-name" className="block text-sm font-medium text-slate-700 mb-1">
              Task name
            </label>
            <input
              id="task-name"
              type="text"
              required
              maxLength={140}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Design homepage"
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="task-start" className="block text-sm font-medium text-slate-700 mb-1">
                Start date
              </label>
              <input
                id="task-start"
                type="date"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
            <div>
              <label htmlFor="task-end" className="block text-sm font-medium text-slate-700 mb-1">
                End date
              </label>
              <input
                id="task-end"
                type="date"
                required
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Priority selector */}
          <div>
            <span className="block text-sm font-medium text-slate-700 mb-1">Priority</span>
            <div className="grid grid-cols-2 gap-2">
              {PRIORITY_OPTIONS.map((opt) => {
                const active = priority === opt.value;
                return (
                  <label
                    key={opt.value}
                    className={`cursor-pointer rounded-lg border-2 px-3 py-2.5 text-center transition ${
                      active ? opt.active : 'border-slate-200 text-slate-500 hover:border-slate-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="priority"
                      className="sr-only"
                      checked={active}
                      onChange={() => setPriority(opt.value)}
                    />
                    <span className="inline-flex items-center gap-1.5 text-sm font-semibold">
                      <span
                        className="w-2 h-2 rounded-full inline-block"
                        style={{ backgroundColor: opt.dot }}
                      />
                      {opt.label}
                    </span>
                    <span className="block text-[11px] mt-0.5 font-normal opacity-80">
                      {opt.hint}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Progress */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label htmlFor="task-progress" className="text-sm font-medium text-slate-700">
                Progress
              </label>
              <span className="text-sm font-semibold text-slate-700">{progress}%</span>
            </div>
            <input
              id="task-progress"
              type="range"
              min="0"
              max="100"
              step="5"
              value={progress}
              onChange={(e) => setProgress(Number(e.target.value))}
              className="w-full accent-indigo-600"
            />
          </div>

          {/* Live bar preview */}
          <div>
            <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              Preview
            </span>
            <div className="h-[22px] rounded-md overflow-hidden ring-1 ring-black/10" style={{ backgroundColor: preview }}>
              <div
                className="h-full transition-all"
                style={{ width: `${progress}%`, backgroundColor: previewFill }}
              />
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1">
            {editing && (
              <button
                type="button"
                disabled={busy}
                onClick={() => onDelete(task.id)}
                className="text-sm font-semibold text-red-600 hover:text-red-500 disabled:opacity-60 px-2 py-2"
              >
                Delete
              </button>
            )}
            <div className="ml-auto flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="text-sm font-semibold text-slate-600 hover:text-slate-800 px-4 py-2"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={busy}
                className="rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white font-semibold text-sm px-5 py-2"
              >
                {busy ? 'Saving…' : editing ? 'Save changes' : 'Add task'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
