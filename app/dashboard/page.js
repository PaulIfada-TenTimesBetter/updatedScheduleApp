import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth';
import { listTasks, getIsDemoMode } from '@/lib/store';
import SchedulerApp from '@/components/SchedulerApp';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const user = await getSessionUser();
  if (!user) redirect('/login');

  let tasks = [];
  try {
    tasks = await listTasks(user.id);
  } catch (err) {
    // Show the dashboard shell with an error banner instead of crashing.
    console.error('[dashboard] failed to load tasks:', err);
    return (
      <SchedulerApp
        user={{ id: user.id, email: user.email, name: user.name }}
        initialTasks={[]}
        loadError="Could not load your tasks — the database is not responding. Verify DATABASE_URL in Netlify, then visit /api/health to diagnose."
        demoMode={getIsDemoMode()}
      />
    );
  }

  return (
    <SchedulerApp
      user={{ id: user.id, email: user.email, name: user.name }}
      initialTasks={tasks}
      demoMode={getIsDemoMode()}
    />
  );
}
