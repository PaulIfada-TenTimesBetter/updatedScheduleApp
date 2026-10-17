'use client';

import { useEffect, useMemo, useRef } from 'react';
import { parseDate, addDays, diffDays, todayISO, formatDateShort } from '@/lib/dates';

const ROW_H = 44;
const HEADER_H = 52;
const SIDEBAR_W = 260;
const ZOOMS = {
  day: 36,
  week: 12,
  month: 3.5,
};

export const PRIORITY = {
  critical: {
    label: 'Critical',
    bar: '#ef4444',
    fill: '#991b1b',
    dot: '#ef4444',
    badge: 'bg-red-100 text-red-700',
  },
  normal: {
    label: 'Normal',
    bar: '#3b82f6',
    fill: '#1e40af',
    dot: '#3b82f6',
    badge: 'bg-blue-100 text-blue-700',
  },
};

export default function GanttChart({ tasks, zoom, onEditTask }) {
  const dayWidth = ZOOMS[zoom] || ZOOMS.day;
  const scrollRef = useRef(null);

  const { days, todayIdx } = useMemo(() => {
    let min = null;
    let max = null;
    for (const t of tasks) {
      const s = parseDate(t.startDate);
      const e = parseDate(t.endDate);
      if (!min || s < min) min = s;
      if (!max || e > max) max = e;
    }
    if (!min) {
      min = parseDate(todayISO());
      max = addDays(min, 14);
    }
    const start = addDays(min, -2);
    let end = addDays(max, 3);
    if (diffDays(start, end) < 20) end = addDays(start, 20);

    const total = diffDays(start, end) + 1;
    const arr = Array.from({ length: total }, (_, i) => addDays(start, i));

    const today = todayISO();
    const idx = arr.findIndex((d) => d.toISOString().slice(0, 10) === today);
    return { days: arr, todayIdx: idx };
  }, [tasks]);

  const months = useMemo(() => {
    const list = [];
    days.forEach((d, i) => {
      const key = `${d.getUTCFullYear()}-${d.getUTCMonth()}`;
      const last = list[list.length - 1];
      if (!last || last.key !== key) {
        list.push({
          key,
          label: d.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }),
          short: d.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' }),
          startIdx: i,
          days: 1,
        });
      } else {
        last.days += 1;
      }
    });
    return list;
  }, [days]);

  // Jump the view to "today" when it mounts or the zoom changes.
  useEffect(() => {
    if (scrollRef.current && todayIdx >= 0) {
      scrollRef.current.scrollLeft = Math.max(0, todayIdx * dayWidth - 140);
    }
  }, [zoom, todayIdx, dayWidth]);

  const timelineW = days.length * dayWidth;

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <div ref={scrollRef} className="gantt-scroll overflow-auto max-h-[68vh]">
        <div className="relative" style={{ width: SIDEBAR_W + timelineW, minWidth: '100%' }}>
          {/* ------- Header ------- */}
          <div
            className="sticky top-0 z-20 flex bg-white/95 backdrop-blur border-b border-slate-200"
            style={{ height: HEADER_H }}
          >
            <div
              className="shrink-0 sticky left-0 z-30 flex items-end justify-between bg-white border-r border-slate-200 px-4 pb-2"
              style={{ width: SIDEBAR_W }}
            >
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Task
              </span>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Schedule
              </span>
            </div>
            <div className="relative shrink-0" style={{ width: timelineW }}>
              {/* Month labels */}
              <div className="flex h-6 border-b border-slate-100">
                {months.map((m) => (
                  <div
                    key={m.key}
                    className="px-2 flex items-center text-xs font-semibold text-slate-700 border-r border-slate-200 whitespace-nowrap overflow-hidden"
                    style={{ width: m.days * dayWidth }}
                  >
                    {m.days * dayWidth > 84 ? m.label : m.days * dayWidth > 26 ? m.short : ''}
                  </div>
                ))}
              </div>
              {/* Day / week / month ticks */}
              <div className="relative h-7">
                {dayWidth >= 24 &&
                  days.map((d, i) => {
                    const isToday = i === todayIdx;
                    return (
                      <div
                        key={i}
                        className={`absolute top-0 flex flex-col items-center justify-center border-r border-slate-100 ${
                          isToday ? 'bg-amber-50' : ''
                        }`}
                        style={{ left: i * dayWidth, width: dayWidth, height: '100%' }}
                      >
                        <span className="text-[9px] uppercase leading-none text-slate-400">
                          {d.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' }).slice(0, 2)}
                        </span>
                        <span
                          className={`text-[11px] font-semibold leading-tight ${
                            isToday ? 'text-amber-600' : 'text-slate-600'
                          }`}
                        >
                          {d.getUTCDate()}
                        </span>
                      </div>
                    );
                  })}
                {dayWidth < 24 &&
                  days.map((d, i) => {
                    const showWeek = dayWidth >= 8 && d.getUTCDay() === 1;
                    const showMonth = dayWidth < 8 && d.getUTCDate() === 1;
                    if (!showWeek && !showMonth) return null;
                    return (
                      <div
                        key={i}
                        className="absolute top-0 bottom-0 border-l border-slate-300 pl-1.5 flex items-center text-[10px] text-slate-500 whitespace-nowrap"
                        style={{ left: i * dayWidth }}
                      >
                        {showWeek
                          ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
                          : d.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' })}
                      </div>
                    );
                  })}
                {todayIdx >= 0 && (
                  <div
                    className="absolute top-0.5 z-10 pointer-events-none"
                    style={{ left: todayIdx * dayWidth + dayWidth / 2 }}
                  >
                    <span className="-translate-x-1/2 inline-block text-[9px] font-bold uppercase tracking-wide text-amber-700 bg-amber-100 border border-amber-300 rounded px-1.5 py-px">
                      Today
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ------- Body ------- */}
          {tasks.length === 0 ? (
            <div
              className="flex items-center justify-center text-center px-6"
              style={{ minHeight: 220 }}
            >
              <div>
                <p className="text-4xl">🗓️</p>
                <p className="mt-3 font-semibold text-slate-700">No tasks yet</p>
                <p className="mt-1 text-sm text-slate-500">
                  Click <span className="font-semibold">+ New task</span> to add your first task
                  to the timeline.
                </p>
              </div>
            </div>
          ) : (
            <div className="relative">
              {/* Grid + weekend shading + today line */}
              <div
                className="absolute inset-y-0 z-0 pointer-events-none"
                style={{ left: SIDEBAR_W, width: timelineW }}
              >
                {days.map((d, i) => {
                  const wd = d.getUTCDay();
                  const weekend = wd === 0 || wd === 6;
                  return (
                    <div
                      key={i}
                      className="absolute inset-y-0 border-r border-slate-100"
                      style={{
                        left: i * dayWidth,
                        width: dayWidth,
                        backgroundColor: weekend && dayWidth >= 14 ? '#f8fafc' : undefined,
                      }}
                    />
                  );
                })}
                {todayIdx >= 0 && (
                  <div
                    className="absolute inset-y-0 z-10"
                    style={{
                      left: todayIdx * dayWidth + dayWidth / 2,
                      borderLeft: '2px dashed #f59e0b',
                    }}
                  />
                )}
              </div>

              {tasks.map((task) => {
                const p = PRIORITY[task.priority] || PRIORITY.normal;
                const s = parseDate(task.startDate);
                const e = parseDate(task.endDate);
                const left = diffDays(days[0], s) * dayWidth + 2;
                const width = Math.max(8, (diffDays(s, e) + 1) * dayWidth - 4);
                return (
                  <div key={task.id} className="relative flex group" style={{ height: ROW_H }}>
                    {/* Sidebar cell */}
                    <div
                      className="shrink-0 sticky left-0 z-20 flex items-center gap-2 bg-white group-hover:bg-slate-50 border-r border-b border-slate-100 px-4"
                      style={{ width: SIDEBAR_W }}
                    >
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: p.dot }}
                        title={`${p.label} task`}
                      />
                      <div className="min-w-0">
                        <p className="text-[13px] font-medium text-slate-800 truncate">
                          {task.name}
                        </p>
                        <p className="text-[11px] text-slate-400 truncate">
                          {formatDateShort(task.startDate)} – {formatDateShort(task.endDate)}
                        </p>
                      </div>
                      <span
                        className={`ml-auto shrink-0 text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded ${p.badge}`}
                      >
                        {p.label}
                      </span>
                    </div>
                    {/* Timeline cell */}
                    <div
                      className="relative shrink-0 group-hover:bg-slate-50/60 border-b border-slate-100"
                      style={{ width: timelineW }}
                    >
                      <button
                        type="button"
                        onClick={() => onEditTask(task)}
                        title={`${task.name} · ${p.label} · ${task.startDate} → ${task.endDate} · ${task.progress}% complete — click to edit`}
                        className="absolute top-1/2 -translate-y-1/2 h-[22px] rounded-md overflow-hidden shadow-sm ring-1 ring-black/10 hover:ring-2 hover:ring-slate-400 transition-all z-10 text-left"
                        style={{ left, width }}
                      >
                        <span
                          className="absolute inset-y-0 left-0"
                          style={{ width: `${task.progress}%`, backgroundColor: p.fill }}
                        />
                        <span className="relative z-10 flex items-center justify-center h-full px-1.5 text-[10px] font-bold text-white whitespace-nowrap drop-shadow-sm">
                          {width >= 46 ? `${task.progress}%` : ''}
                        </span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
