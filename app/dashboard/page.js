import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth';
import { listTasks, isDemoMode } from '@/lib/store';
import SchedulerApp from '@/components/SchedulerApp';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const user = await getSessionUser();
  if (!user) redirect('/login');

  const tasks = await listTasks(user.id);

  return (
    <SchedulerApp
      user={{ id: user.id, email: user.email, name: user.name }}
      initialTasks={tasks}
      demoMode={isDemoMode}
    />
  );
}
