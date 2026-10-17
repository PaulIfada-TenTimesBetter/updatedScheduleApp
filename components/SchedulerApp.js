'use client';

import { useEffect, useState } from 'react';
import GanttChart from './GanttChart';
import TaskModal from './TaskModal';
import ImportModal from './ImportModal';
import TrackerTable from './TrackerTable';
import Legend from './Legend';
import { downloadGanttPng } from '@/lib/exportGantt';

function useLocalState(key, initial) {
  const [value, setValue] = useState(initial);
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(key);
      if (saved !== null) setValue(saved);
    } catch {}
  }, [key]);
  const update = (v) => {
    setValue(v);
    try {
      window.localStorage.setItem(key, v);
    } catch {}
  };
  return [value, update];
}

export default function SchedulerApp({ user, initialTasks, demoMode, loadError }) {
  const [tasks, setTasks] = useState(initialTasks || []);
  const [zoom, setZoom] = useState('day');
  const [tab, setTab] = useState('scheduler'); // 'scheduler' | 'tracker'
  const [modal, setModal] = useState(null); // null | { task: null } | { task }
  const [importOpen, setImportOpen] = useState(false);
  const [modalError, setModalError] = useState('');
  const [importError, setImportError] = useState('');
  const [busy, setBusy] = useState(false);
  const [importing, setImporting] = useState(false);
  const [notice, setNotice] = useState('');

  const [theme, setTheme] = useLocalState('tt-theme', 'light');
  const [chartTitle, setChartTitle] = useLocalState('tt-chart-title', 'Project Schedule');
  const [sidebarLabel, setSidebarLabel] = useLocalState('tt-sidebar-label', 'Task');
  const [showProgress, setShowProgress] = useLocalState('tt-show-progress', '1');

  const displayName = user.name || user.email;
  const criticalCount = tasks.filter((t) => t.priority === 'critical').length;
  const totalWeight = tasks.reduce((s, t) => s + Math.max(1, Math.min(100, t.weight || 1)), 0);
  const weightedProgress = totalWeight
    ? Math.round(
        tasks.reduce(
          (s, t) => s + (t.progress || 0) * Math.max(1, Math.min(100, t.weight || 1)),
          0
        ) / totalWeight
      )
    : 0;
  const showProgressBool = showProgress === '1';

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

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

  async function handlePatchTask(taskId, fields) {
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fields),
      });
      if (res.status === 401) {
        window.location.href = '/login';
        return;
      }
      const payload = await res.json().catch(() => ({}));
      if (res.ok && payload.task) {
        setTasks((prev) => prev.map((t) => (t.id === taskId ? payload.task : t)));
      }
    } catch {
      /* keep the local value; user can retry by editing again */
    }
  }

  async function handleImport(taskList) {
    setImporting(true);
    setImportError('');
    try {
      const res = await fetch('/api/tasks/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tasks: taskList }),
      });
      if (res.status === 401) {
        window.location.href = '/login';
        return;
      }
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setImportError(payload.error || 'Import failed.');
        return;
      }
      setTasks((prev) => [...prev, ...(payload.created || [])]);
      setImportOpen(false);
      const skipped = (payload.failed || []).length;
      setNotice(
        `Imported ${payload.created.length} task${payload.created.length === 1 ? '' : 's'}` +
          (skipped ? ` · ${skipped} row${skipped === 1 ? '' : 's'} skipped (bad data)` : '')
      );
      setTimeout(() => setNotice(''), 6000);
    } catch {
      setImportError('Network error — please try again.');
    } finally {
      setImporting(false);
    }
  }

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
    window.location.href = '/login';
  }

  function handleSnapshot() {
    downloadGanttPng({
      tasks,
      zoom,
      title: chartTitle || 'Project Schedule',
      sidebarLabel,
      showProgress: showProgressBool,
    });
  }

  const inputCls =
    'rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500';

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top bar */}
      <header className="bg-slate-900 dark:bg-slate-800 text-white border-b border-black/20">
        <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-indigo-500 to-sky-400 flex items-center justify-center font-black text-sm shrink-0">
              10×
            </div>
            <div className="min-w-0">
              <h1 className="font-bold leading-tight truncate">TenTimesetter-Scheduler</h1>
              <p className="text-[11px] text-slate-400 leading-tight hidden sm:block">
                Schedule &amp; track — built for real projects
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              className="w-9 h-9 rounded-lg bg-white/10 hover:bg-white/20 text-base"
              aria-label="Toggle dark mode"
            >
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>
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
        {/* Tabs */}
        <div className="flex rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-1 w-fit">
          {[
            ['scheduler', '📅 Scheduler'],
            ['tracker', '📊 Progress Tracker'],
          ].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`px-5 py-2 rounded-lg text-sm font-semibold transition ${
                tab === key
                  ? 'bg-indigo-600 text-white shadow'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {notice && (
          <div className="rounded-xl border border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 text-sm px-4 py-3">
            ✅ {notice}
          </div>
        )}
        {demoMode && (
          <div className="rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950 text-amber-800 dark:text-amber-200 text-sm px-4 py-3">
            <strong className="font-semibold">Demo mode.</strong> No database is connected, so
            accounts and tasks are saved to a local file. Set the{' '}
            <code className="font-mono">DATABASE_URL</code> env var (Neon) on Netlify to store
            data in Postgres.
          </div>
        )}

        {/* Chart title + label editor */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <input
            type="text"
            value={chartTitle}
            maxLength={140}
            onChange={(e) => setChartTitle(e.target.value)}
            placeholder="Chart title — e.g. NIGER STATE GAS MASTER PLAN"
            className="flex-1 text-xl sm:text-2xl font-black bg-transparent border border-transparent hover:border-slate-300 dark:hover:border-slate-600 focus:border-indigo-500 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-slate-100 placeholder:text-slate-300 dark:placeholder:text-slate-600"
            aria-label="Chart title"
          />
          <div className="flex items-center gap-2 shrink-0">
            <label
              htmlFor="sidebar-label"
              className="text-xs font-bold uppercase tracking-wider text-slate-400"
            >
              Row label
            </label>
            <input
              id="sidebar-label"
              type="text"
              value={sidebarLabel}
              maxLength={30}
              onChange={(e) => setSidebarLabel(e.target.value)}
              placeholder="Task"
              className={`${inputCls} w-32`}
            />
          </div>
        </div>

        {tab === 'scheduler' ? (
          <>
            {/* Stats */}
            <div className="grid grid-cols-3 gap-3">
              <StatCard label="Total tasks" value={tasks.length} />
              <StatCard
                label="Critical tasks"
                value={criticalCount}
                valueClass={criticalCount > 0 ? 'text-red-500' : 'text-slate-800 dark:text-slate-100'}
              />
              <StatCard label="Overall progress" value={`${weightedProgress}%`} />
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
              <button
                onClick={() => {
                  setImportError('');
                  setImportOpen(true);
                }}
                className="rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold text-sm px-4 py-2.5"
              >
                ⬆ Import Excel
              </button>
              <div className="flex rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 overflow-hidden">
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
                        ? 'bg-slate-900 dark:bg-indigo-600 text-white'
                        : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setShowProgress(showProgressBool ? '0' : '1')}
                title="Switch between progress-filled bars and solid bars"
                className={`rounded-lg border font-semibold text-xs px-3.5 py-2.5 ${
                  showProgressBool
                    ? 'border-indigo-300 dark:border-indigo-700 bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300'
                    : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200'
                }`}
              >
                {showProgressBool ? '📊 Progress shown' : '🟦 Solid bars'}
              </button>
              <button
                onClick={handleSnapshot}
                disabled={!tasks.length}
                title="Download the chart as a PNG image"
                className="rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed text-slate-700 dark:text-slate-200 font-semibold text-xs px-3.5 py-2.5"
              >
                ⬇ Snapshot (PNG)
              </button>
              <div className="ml-auto">
                <Legend showProgress={showProgressBool} />
              </div>
            </div>

            {/* Gantt */}
            <GanttChart
              tasks={tasks}
              zoom={zoom}
              showProgress={showProgressBool}
              sidebarLabel={sidebarLabel}
              onEditTask={(task) => {
                setModalError('');
                setModal({ task });
              }}
            />

            <p className="text-xs text-slate-400 text-center pb-2">
              Tip: click any bar to edit the task · import a whole spreadsheet with ⬆ Import
              Excel · everything also appears in the Progress Tracker.
            </p>
          </>
        ) : (
          <TrackerTable
            tasks={tasks}
            title={chartTitle}
            loadError={loadError}
            onPatchTask={handlePatchTask}
            onDeleteTask={handleDelete}
          />
        )}
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

      {importOpen && (
        <ImportModal
          busy={importing}
          error={importError}
          onImport={handleImport}
          onClose={() => {
            setImportOpen(false);
            setImportError('');
          }}
        />
      )}
    </div>
  );
}

function StatCard({ label, value, valueClass = 'text-slate-800 dark:text-slate-100' }) {
  return (
    <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-4 py-3.5">
      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
      <p className={`mt-0.5 text-2xl font-bold ${valueClass}`}>{value}</p>
    </div>
  );
}
