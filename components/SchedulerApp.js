'use client';

import { useEffect, useRef, useState } from 'react';
import GanttChart from './GanttChart';
import TaskModal from './TaskModal';
import ImportModal from './ImportModal';
import TrackerTable from './TrackerTable';
import Legend from './Legend';
import { downloadGanttPng } from '@/lib/exportGantt';
import { downloadTrackerPdf } from '@/lib/exportTracker';

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

export default function SchedulerApp({ user, initialTasks, initialSettings, demoMode, loadError }) {
  const [tasks, setTasks] = useState(initialTasks || []);
  const [zoom, setZoom] = useState('day');
  const [tab, setTab] = useState('scheduler'); // 'scheduler' | 'tracker'
  const [modal, setModal] = useState(null);
  const [importOpen, setImportOpen] = useState(false);
  const [modalError, setModalError] = useState('');
  const [importError, setImportError] = useState('');
  const [busy, setBusy] = useState(false);
  const [importing, setImporting] = useState(false);
  const [notice, setNotice] = useState('');

  const [theme, setTheme] = useLocalState('tt-theme', 'light');
  const [sidebarLabel, setSidebarLabel] = useLocalState('tt-sidebar-label', 'Task');

  // Project settings — persisted to the database per user.
  const [chartTitle, setChartTitle] = useState(initialSettings?.projectTitle || '');
  const [projectStart, setProjectStart] = useState(initialSettings?.projectStart || '');
  const [projectEnd, setProjectEnd] = useState(initialSettings?.projectEnd || '');
  const settingsTimer = useRef(null);

  const displayName = user.name || user.email;
  const criticalCount = tasks.filter((t) => t.priority === 'critical').length;
  const title = chartTitle.trim() || 'Project Schedule';

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  // Debounced save of project settings (title + duration).
  function queueSettingsSave(next) {
    clearTimeout(settingsTimer.current);
    settingsTimer.current = setTimeout(async () => {
      try {
        const res = await fetch('/api/settings', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projectTitle: next.chartTitle ?? chartTitle,
            projectStart: next.projectStart ?? projectStart,
            projectEnd: next.projectEnd ?? projectEnd,
          }),
        });
        if (res.status === 401) window.location.href = '/login';
      } catch {}
    }, 700);
  }

  function updateChartTitle(v) {
    setChartTitle(v);
    queueSettingsSave({ chartTitle: v });
  }
  function updateProjectStart(v) {
    setProjectStart(v);
    queueSettingsSave({ projectStart: v });
  }
  function updateProjectEnd(v) {
    setProjectEnd(v);
    queueSettingsSave({ projectEnd: v });
  }

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
      /* keep the local value; the user can retry by editing again */
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
      title,
      sidebarLabel,
      projectStart: projectStart || undefined,
      projectEnd: projectEnd || undefined,
    });
  }

  function handleTrackerPdf() {
    downloadTrackerPdf({ tasks, title });
  }

  const inputCls =
    'rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500';

  const durationLabel = (() => {
    if (!projectStart || !projectEnd) return '—';
    const days = Math.round(
      (new Date(projectEnd).getTime() - new Date(projectStart).getTime()) / 86400000
    ) + 1;
    const weeks = Math.max(1, Math.round(days / 7));
    return `${days} day${days === 1 ? '' : 's'} (~${weeks} wk)`;
  })();

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
        {loadError && (
          <div className="rounded-xl border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950 text-red-800 dark:text-red-300 text-sm px-4 py-3">
            <strong className="font-semibold">Database error.</strong> {loadError}
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

        {/* Project title + duration (saved to your account) */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3.5 flex flex-col lg:flex-row lg:items-center gap-3">
          <div className="flex-1">
            <label htmlFor="project-title" className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Project title
            </label>
            <input
              id="project-title"
              type="text"
              value={chartTitle}
              maxLength={140}
              onChange={(e) => updateChartTitle(e.target.value)}
              placeholder="Type the project title — e.g. NIGER STATE GAS MASTER PLAN"
              className="mt-0.5 w-full text-xl sm:text-2xl font-black bg-transparent border border-transparent hover:border-slate-300 dark:hover:border-slate-600 focus:border-indigo-500 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-slate-100 placeholder:text-slate-300 dark:placeholder:text-slate-600"
            />
          </div>
          <div className="flex items-end gap-3 shrink-0">
            <div>
              <label htmlFor="project-start" className="block text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Project start
              </label>
              <input
                id="project-start"
                type="date"
                value={projectStart}
                onChange={(e) => updateProjectStart(e.target.value)}
                className={`${inputCls} mt-0.5`}
              />
            </div>
            <div>
              <label htmlFor="project-end" className="block text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Project end
              </label>
              <input
                id="project-end"
                type="date"
                value={projectEnd}
                onChange={(e) => updateProjectEnd(e.target.value)}
                className={`${inputCls} mt-0.5`}
              />
            </div>
            <div className="pb-1">
              <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-400">Duration</span>
              <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">{durationLabel}</span>
            </div>
          </div>
        </div>

        {tab === 'scheduler' ? (
          <>
            {/* Scheduler toolbar */}
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
                onClick={handleSnapshot}
                disabled={!tasks.length}
                title="Download the chart as a PNG image"
                className="rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed text-slate-700 dark:text-slate-200 font-semibold text-xs px-3.5 py-2.5"
              >
                ⬇ Snapshot (PNG)
              </button>
              <div className="flex items-center gap-2">
                <label
                  htmlFor="sidebar-label"
                  className="text-[11px] font-bold uppercase tracking-wider text-slate-400"
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
                  className={`${inputCls} w-28`}
                />
              </div>
              <div className="ml-auto">
                <Legend />
              </div>
            </div>

            {/* Gantt */}
            <GanttChart
              tasks={tasks}
              zoom={zoom}
              sidebarLabel={sidebarLabel}
              projectStart={projectStart || undefined}
              projectEnd={projectEnd || undefined}
              onEditTask={(task) => {
                setModalError('');
                setModal({ task });
              }}
            />

            <p className="text-xs text-slate-400 text-center pb-2">
              Tip: click any bar to edit the task · progress % lives in the 📊 Progress
              Tracker tab.
            </p>
          </>
        ) : (
          <>
            {/* Tracker toolbar */}
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={handleTrackerPdf}
                disabled={!tasks.length}
                title="Download the progress tracker as a PDF"
                className="rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-xs px-4 py-2.5"
              >
                ⬇ Snapshot (PDF)
              </button>
              <span className="text-xs text-slate-400">
                {tasks.length} task{tasks.length === 1 ? '' : 's'} being tracked
              </span>
            </div>

            <TrackerTable
              tasks={tasks}
              title={title}
              onPatchTask={handlePatchTask}
              onDeleteTask={handleDelete}
            />
          </>
        )}
      </main>

      {modal && (
        <TaskModal
          task={modal.task}
          defaultStart={projectStart || undefined}
          defaultEnd={projectEnd || undefined}
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
