import Link from 'next/link';

export default function AuthShell({ title, subtitle, demoMode, children }) {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4 py-10 bg-gradient-to-b from-slate-900 to-slate-800">
      <Link href="/" className="flex items-center gap-3 mb-8 group">
        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-500 to-sky-400 flex items-center justify-center font-black text-sm text-white shadow-lg shadow-indigo-500/30">
          10×
        </div>
        <span className="font-bold text-white text-lg group-hover:text-indigo-200">
          TenTimesBetter-Scheduler
        </span>
      </Link>

      {demoMode && (
        <div className="w-full max-w-md mb-4 rounded-xl border border-amber-400/30 bg-amber-400/10 text-amber-200 text-sm px-4 py-3">
          <strong className="font-semibold">Demo mode.</strong> No database is connected, so
          accounts and tasks are stored in a local file. Set the{' '}
          <code className="text-amber-100">DATABASE_URL</code> env var (Neon) on Netlify for
          production.
        </div>
      )}

      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-2xl">
        <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
        <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
        <div className="mt-6">{children}</div>
      </div>

      <p className="mt-8 text-xs text-slate-400">
        Protected by email + password sign-in · TenTimesBetter-Scheduler
      </p>
    </main>
  );
}
