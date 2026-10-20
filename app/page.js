import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const user = await getSessionUser();
  if (user) redirect('/dashboard');

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-900 to-slate-800 text-white">
      {/* Nav */}
      <nav className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Logo />
          <span className="font-bold">TenTimesBetter-Scheduler</span>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/login"
            className="px-4 py-2 rounded-lg text-sm font-medium text-slate-200 hover:text-white hover:bg-white/10"
          >
            Log in
          </Link>
          <Link
            href="/signup"
            className="px-4 py-2 rounded-lg text-sm font-semibold bg-indigo-500 hover:bg-indigo-400"
          >
            Create account
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 pt-20 pb-24 text-center">
        <p className="inline-block text-xs font-semibold tracking-widest uppercase text-indigo-300 bg-indigo-500/10 border border-indigo-400/30 rounded-full px-4 py-1.5 mb-6">
          Account-based project scheduling
        </p>
        <h1 className="text-4xl sm:text-6xl font-black tracking-tight leading-tight">
          TenTimesBetter-Scheduler
        </h1>
        <p className="mt-5 text-lg text-slate-300 max-w-2xl mx-auto">
          Plan your projects on a visual Gantt timeline. Create your own account, add tasks,
          mark which ones are <span className="text-red-400 font-semibold">critical</span> and
          which are <span className="text-blue-400 font-semibold">normal</span>, and track
          progress at a glance.
        </p>
        <div className="mt-9 flex items-center justify-center gap-3">
          <Link
            href="/signup"
            className="px-6 py-3 rounded-xl font-semibold bg-indigo-500 hover:bg-indigo-400 shadow-lg shadow-indigo-500/25"
          >
            Get started — it&apos;s free
          </Link>
          <Link
            href="/login"
            className="px-6 py-3 rounded-xl font-semibold bg-white/10 hover:bg-white/20 border border-white/10"
          >
            Log in
          </Link>
        </div>

        {/* Feature cards */}
        <div className="mt-20 grid sm:grid-cols-3 gap-4 text-left">
          <FeatureCard
            icon="🔐"
            title="Your own account"
            body="Sign up with email and a password. Your schedule is private to your account."
          />
          <FeatureCard
            icon="🚩"
            title="Critical vs Normal"
            body="Flag the tasks that must not slip. Critical tasks show in red, normal ones in blue."
            legend
          />
          <FeatureCard
            icon="📈"
            title="Zoomable timeline"
            body="Day, week or month view — with a today marker and progress on every bar."
          />
        </div>
      </section>

      <footer className="border-t border-white/10 py-8 text-center text-sm text-slate-400">
        TenTimesBetter-Scheduler
      </footer>
    </main>
  );
}

function Logo() {
  return (
    <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-indigo-500 to-sky-400 flex items-center justify-center font-black text-sm text-white shadow-lg shadow-indigo-500/30">
      10×
    </div>
  );
}

function FeatureCard({ icon, title, body, legend }) {
  return (
    <div className="rounded-2xl bg-white/5 border border-white/10 p-6">
      <div className="text-2xl">{icon}</div>
      <h3 className="mt-3 font-bold">{title}</h3>
      <p className="mt-1.5 text-sm text-slate-300">{body}</p>
      {legend && (
        <div className="mt-4 flex items-center gap-3 text-xs">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-4 h-2.5 rounded bg-red-500 inline-block" /> Critical
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-4 h-2.5 rounded bg-blue-500 inline-block" /> Normal
          </span>
        </div>
      )}
    </div>
  );
}
