export default function Legend() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs text-slate-600 dark:text-slate-300">
      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
        Legend
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="w-4 h-2.5 rounded-sm bg-red-500 inline-block" />
        Critical task
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="w-4 h-2.5 rounded-sm bg-blue-500 inline-block" />
        Normal task
      </span>
    </div>
  );
}
