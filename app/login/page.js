import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth';
import { isDemoMode } from '@/lib/store';
import AuthShell from '@/components/AuthShell';
import LoginForm from '@/components/LoginForm';

export const dynamic = 'force-dynamic';

export default async function LoginPage() {
  const user = await getSessionUser();
  if (user) redirect('/dashboard');

  return (
    <AuthShell demoMode={isDemoMode} title="Welcome back" subtitle="Log in to your schedule">
      <LoginForm />
    </AuthShell>
  );
}
