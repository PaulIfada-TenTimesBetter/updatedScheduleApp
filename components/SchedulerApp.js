'use client';

import { useState } from 'react';
import GanttChart from './GanttChart';
import TaskModal from './TaskModal';
import Legend from './Legend';

export default function SchedulerApp({ user, initialTasks, demoMode, loadError }) {
  const [tasks, setTasks] = useState(initialTasks || []);
  const [zoom, setZoom] = useState('day');
  const [modal, setModal] = useState(null); // null | { task: null } | { task }
  const [modalError, setModalError] = useState('');
  const [busy, setBusy] = useState(false);

  const displayName = user.name || user.email;
  const criticalCount = tasks.filter((t) => t.priority === 'critical').length;
  const avgProgress = tasks.length
    ? Math.round(tasks.reduce((sum, t) => sum + (t.progress || 0), 0) / tasks.length)
    : 0;

  async function handleSave(data, taskId) {
    setBusy(true);
    setModalError('');
    try {
      const res = await fetch(taskId ? `/api/tasks/${taskId}` : '/api/tasks', {
        method: taskId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (res.status === 401) {
        window.location.href = '/login';
        return;
      }
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setModalError(payload.error || 'Could not save the task.');
        return;
      }
      const saved = payload.task;
      setTasks((prev) =>
        taskId ? prev.map((t) => (t.id === taskId ? saved : t)) : [...prev, saved]
      );
      setModal(null);
    } catch {
      setModalError('Network error — please try again.');
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(taskId) {
    if (!window.confirm('Delete this task? This cannot be undone.')) return;
    setBusy(true);
    setModalError('');
    try {
      const res = await fetch(`/api/tasks/${taskId}`, { method: 'DELETE' });
      if (res.status === 401) {
        window.location.href = '/login';
        return;
      }
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        setModalError(payload.error || 'Could not delete the task.');
        return;
      }
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
      setModal(null);
    } catch {
      setModalError('Network error — please try again.');
    } finally {
      setBusy(false);
    }
  }

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
    window.location.href = '/login';
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top bar */}
      <header className="bg-slate-900 text-white">
        <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-indigo-500 to-sky-400 flex items-center justify-center font-black text-sm shrink-0">
              10×
            </div>
            <div className="min-w-0">
              <h1 className="font-bold leading-tight truncate">TenTimesetter-Scheduler</h1>
              <p className="text-[11px] text-slate-400 leading-tight hidden sm:block">
                Critical &amp; normal tasks on one timeline
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <span className="hidden md:block text-sm text-slate-300">{displayName}</span>
            <button
              onClick={handleLogout}
              className="text-sm font-semibold bg-white/10 hover:bg-white/20 px-3.5 py-1.5 rounded-lg"
            >
              Log out
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 space-y-5">
        {loadError && (
          <div className="rounded-xl border border-red-300 bg-red-50 text-red-800 text-sm px-4 py-3">
            <strong className="font-semibold">Database error.</strong> {loadError}
          </div>
        )}

        {demoMode && (
          <div className="rounded-xl border border-amber-300 bg-amber-50 text-amber-800 text-sm px-4 py-3">
            <strong className="font-semibold">Demo mode.</strong> No database is connected, so
            accounts and tasks are saved to a local file. Set the{' '}
            <code className="font-mono">DATABASE_URL</code> env var (Neon) on Netlify to store
            data in Postgres.
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <StatCard label="Total tasks" value={tasks.length} />
          <StatCard
            label="Critical tasks"
            value={criticalCount}
            valueClass={criticalCount > 0 ? 'text-red-600' : 'text-slate-800'}
          />
          <StatCard label="Average progress" value={`${avgProgress}%`} />
        </div>

        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => {
              setModalError('');
              setModal({ task: null });
            }}
            className="rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm px-4 py-2.5 shadow-sm"
          >
            + New task
          </button>
          <div className="flex rounded-lg border border-slate-300 bg-white overflow-hidden">
            {[
              ['day', 'Day'],
              ['week', 'Week'],
              ['month', 'Month'],
            ].map(([key, label]) => (
              <button
                key={key}
                onClick={() => setZoom(key)}
                className={`px-3.5 py-2 text-xs font-semibold ${
                  zoom === key
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="ml-auto">
            <Legend />
          </div>
        </div>

        {/* Gantt */}
        <GanttChart
          tasks={tasks}
          zoom={zoom}
          onEditTask={(task) => {
            setModalError('');
            setModal({ task });
          }}
        />

        <p className="text-xs text-slate-400 text-center pb-2">
          Tip: click any bar to edit the task, change its priority, or update progress.
        </p>
      </main>

      {modal && (
        <TaskModal
          task={modal.task}
          busy={busy}
          error={modalError}
          onSave={handleSave}
          onDelete={handleDelete}
          onClose={() => {
            setModal(null);
            setModalError('');
          }}
        />
      )}
    </div>
  );
}

function StatCard({ label, value, valueClass = 'text-slate-800' }) {
  return (
    <div className="rounded-xl bg-white border border-slate-200 px-4 py-3.5">
      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
      <p className={`mt-0.5 text-2xl font-bold ${valueClass}`}>{value}</p>
    </div>
  );
}
