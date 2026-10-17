import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth';
import { getIsDemoMode } from '@/lib/store';
import AuthShell from '@/components/AuthShell';
import LoginForm from '@/components/LoginForm';

export const dynamic = 'force-dynamic';

export default async function LoginPage() {
  const user = await getSessionUser();
  if (user) redirect('/dashboard');

  return (
    <AuthShell demoMode={getIsDemoMode()} title="Welcome back" subtitle="Log in to your schedule">
      <LoginForm />
    </AuthShell>
  );
}
