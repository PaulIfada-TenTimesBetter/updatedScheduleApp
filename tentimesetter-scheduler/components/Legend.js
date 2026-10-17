export default function Legend() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg bg-white border border-slate-200 px-3 py-2 text-xs text-slate-600">
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
      <span className="inline-flex items-center gap-1.5">
        <span className="relative w-4 h-2.5 rounded-sm bg-blue-300 inline-block overflow-hidden">
          <span className="absolute inset-y-0 left-0 w-1/2 bg-blue-800" />
        </span>
        Completed progress
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="inline-block w-0 h-3 border-l-2 border-dashed border-amber-500" />
        Today
      </span>
    </div>
  );
}
