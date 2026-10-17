import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth';
import { getIsDemoMode } from '@/lib/store';
import AuthShell from '@/components/AuthShell';
import SignupForm from '@/components/SignupForm';

export const dynamic = 'force-dynamic';

export default async function SignupPage() {
  const user = await getSessionUser();
  if (user) redirect('/dashboard');

  return (
    <AuthShell
      demoMode={getIsDemoMode()}
      title="Create your account"
      subtitle="Set up an email and password to start scheduling"
    >
      <SignupForm />
    </AuthShell>
  );
}
