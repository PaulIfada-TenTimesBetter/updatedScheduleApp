import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth';
import { listTasks, getSettings, getIsDemoMode } from '@/lib/store';
import SchedulerApp from '@/components/SchedulerApp';

export const dynamic = 'force-dynamic';

/** Defensive: guarantee tasks carry only string dates (never Date objects). */
function asISOOrNull(v) {
  if (!v) return null;
  if (v instanceof Date) {
    return Number.isNaN(v.getTime()) ? null : v.toISOString().slice(0, 10);
  }
  if (typeof v === 'string') return v.slice(0, 10);
  return null;
}

function normalizeSettings(s) {
  s = s || {};
  return {
    projectTitle: typeof s.projectTitle === 'string' ? s.projectTitle : '',
    projectStart: asISOOrNull(s.projectStart),
    projectEnd: asISOOrNull(s.projectEnd),
  };
}

function normalizeTasks(tasks) {
  return (tasks || []).map((t) => ({
    ...t,
    startDate: asISOOrNull(t.startDate) || '',
    endDate: asISOOrNull(t.endDate) || '',
  }));
}

export default async function DashboardPage() {
  const user = await getSessionUser();
  if (!user) redirect('/login');

  let tasks = [];
  let settings = { projectTitle: '', projectStart: null, projectEnd: null };
  let loadError = '';
  try {
    [tasks, settings] = await Promise.all([listTasks(user.id), getSettings(user.id)]);
    tasks = normalizeTasks(tasks);
    settings = normalizeSettings(settings);
  } catch (err) {
    // Show the app shell with an error banner instead of crashing.
    console.error('[dashboard] failed to load data:', err);
    loadError =
      'Could not load your data — the database is not responding. Verify DATABASE_URL in Netlify, then visit /api/health to diagnose.';
    try {
      settings = normalizeSettings(await getSettings(user.id));
    } catch {}
  }

  return (
    <SchedulerApp
      user={{ id: user.id, email: user.email, name: user.name }}
      initialTasks={tasks}
      initialSettings={settings}
      demoMode={getIsDemoMode()}
      loadError={loadError}
    />
  );
}
