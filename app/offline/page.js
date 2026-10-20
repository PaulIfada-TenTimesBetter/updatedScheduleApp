'use client';

export default function Offline() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 text-center bg-gradient-to-b from-slate-900 to-slate-800 text-white">
      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-sky-400 flex items-center justify-center font-black mb-5">
        10×
      </div>
      <h1 className="text-2xl font-black mb-2">You&apos;re offline</h1>
      <p className="text-slate-300 text-sm max-w-sm mb-6">
        TenTimesBetter-Scheduler is installed on this device, but your project data lives
        securely in the cloud — reconnect to pick up where you left off.
      </p>
      <button
        onClick={() => window.location.reload()}
        className="rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm px-5 py-2.5"
      >
        Try again
      </button>
    </main>
  );
}
