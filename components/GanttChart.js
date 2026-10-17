'use client';

import { Fragment, useEffect, useMemo, useRef } from 'react';
import { parseDate, addDays, diffDays, todayISO, formatDateShort } from '@/lib/dates';
import { PRIORITY } from '@/lib/priority';
import { groupTasksBySection } from '@/lib/sections';

const ROW_H = 44;
const SECTION_H = 36;
const HEADER_H = 52;
const SIDEBAR_W = 260;
const ZOOMS = {
  day: 36,
  week: 12,
  month: 3.5,
};

export default function GanttChart({ tasks, zoom, sidebarLabel = 'Task', projectStart, projectEnd, onEditTask }) {
  const dayWidth = ZOOMS[zoom] || ZOOMS.day;
  const scrollRef = useRef(null);

  const { days } = useMemo(() => {
    let min = null;
    let max = null;
    const consider = (iso) => {
      if (!iso) return;
      const d = parseDate(iso);
      if (!min || d < min) min = d;
      if (!max || d > max) max = d;
    };
    for (const t of tasks) {
      consider(t.startDate);
      consider(t.endDate);
    }
    consider(projectStart);
    consider(projectEnd);
    if (!min) {
      min = parseDate(todayISO());
      max = addDays(min, 14);
    }
    const start = addDays(min, -2);
    let end = addDays(max, 3);
    if (diffDays(start, end) < 20) end = addDays(start, 20);

    const total = diffDays(start, end) + 1;
    return { days: Array.from({ length: total }, (_, i) => addDays(start, i)) };
  }, [tasks, projectStart, projectEnd]);

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

  const groups = useMemo(() => groupTasksBySection(tasks), [tasks]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollLeft = 0;
    }
  }, [zoom]);

  const timelineW = days.length * dayWidth;

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden">
      <div ref={scrollRef} className="gantt-scroll overflow-auto max-h-[68vh]">
        <div className="relative" style={{ width: SIDEBAR_W + timelineW, minWidth: '100%' }}>
          {/* ------- Header ------- */}
          <div
            className="sticky top-0 z-20 flex bg-white/95 dark:bg-slate-900/95 backdrop-blur border-b border-slate-200 dark:border-slate-700"
            style={{ height: HEADER_H }}
          >
            <div
              className="shrink-0 sticky left-0 z-30 flex items-end bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-700 px-4 pb-2"
              style={{ width: SIDEBAR_W }}
            >
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                {sidebarLabel || 'Task'}
              </span>
            </div>
            <div className="relative shrink-0" style={{ width: timelineW }}>
              {/* Month labels */}
              <div className="flex h-6 border-b border-slate-100 dark:border-slate-800">
                {months.map((m) => (
                  <div
                    key={m.key}
                    className="px-2 flex items-center text-xs font-semibold text-slate-700 dark:text-slate-200 border-r border-slate-200 dark:border-slate-700 whitespace-nowrap overflow-hidden"
                    style={{ width: m.days * dayWidth }}
                  >
                    {m.days * dayWidth > 84 ? m.label : m.days * dayWidth > 26 ? m.short : ''}
                  </div>
                ))}
              </div>
              {/* Day ticks */}
              <div className="relative h-7">
                {dayWidth >= 24 &&
                  days.map((d, i) => {
                    const weekend = d.getUTCDay() === 0 || d.getUTCDay() === 6;
                    return (
                      <div
                        key={i}
                        className={`absolute top-0 flex flex-col items-center justify-center border-r border-slate-100 dark:border-slate-800 ${
                          weekend ? 'bg-slate-50 dark:bg-slate-800' : ''
                        }`}
                        style={{ left: i * dayWidth, width: dayWidth, height: '100%' }}
                      >
                        <span className="text-[9px] uppercase leading-none text-slate-400">
                          {d.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' }).slice(0, 2)}
                        </span>
                        <span className="text-[11px] font-semibold leading-tight text-slate-600 dark:text-slate-300">
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
                        className="absolute top-0 bottom-0 border-l border-slate-300 dark:border-slate-600 pl-1.5 flex items-center text-[10px] text-slate-500 dark:text-slate-400 whitespace-nowrap"
                        style={{ left: i * dayWidth }}
                      >
                        {showWeek
                          ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
                          : d.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' })}
                      </div>
                    );
                  })}
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
                <p className="mt-3 font-semibold text-slate-700 dark:text-slate-200">
                  No tasks yet
                </p>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Click <span className="font-semibold">+ New task</span> to add your first task,
                  or <span className="font-semibold">⬆ Import Excel</span> to bring in a whole list.
                </p>
              </div>
            </div>
          ) : (
            <div className="relative">
              {/* Grid + weekend shading */}
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
                      className={`absolute inset-y-0 border-r border-slate-100 dark:border-slate-800 ${
                        weekend && dayWidth >= 14 ? 'bg-slate-50 dark:bg-slate-800/60' : ''
                      }`}
                      style={{ left: i * dayWidth, width: dayWidth }}
                    />
                  );
                })}
              </div>

              {groups.map((group, gi) => (
                <Fragment key={group.section ? `${group.section}-${gi}` : 'all-tasks'}>
                  {/* Section band */}
                  {group.section && (
                    <div className="relative flex" style={{ height: SECTION_H }}>
                      <div
                        className="shrink-0 sticky left-0 z-20 flex items-center bg-amber-100 dark:bg-amber-900/40 border-r border-b border-amber-200 dark:border-amber-800 px-4"
                        style={{ width: SIDEBAR_W }}
                      >
                        <span className="text-[12px] font-extrabold text-amber-800 dark:text-amber-200 truncate">
                          {group.section}
                        </span>
                      </div>
                      <div
                        className="shrink-0 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200/70 dark:border-amber-800/70"
                        style={{ width: timelineW }}
                      />
                    </div>
                  )}

                  {/* Task rows */}
                  {group.tasks.map((task) => {
                    const p = PRIORITY[task.priority] || PRIORITY.normal;
                    const s = parseDate(task.startDate);
                    const e = parseDate(task.endDate);
                    const left = diffDays(days[0], s) * dayWidth + 2;
                    const width = Math.max(8, (diffDays(s, e) + 1) * dayWidth - 4);
                    return (
                      <div key={task.id} className="relative flex group" style={{ height: ROW_H }}>
                        {/* Sidebar cell */}
                        <div
                          className="shrink-0 sticky left-0 z-20 flex items-center gap-2 bg-white dark:bg-slate-900 group-hover:bg-slate-50 dark:group-hover:bg-slate-800 border-r border-b border-slate-100 dark:border-slate-800 px-4"
                          style={{ width: SIDEBAR_W }}
                        >
                          <span
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{ backgroundColor: p.dot }}
                            title={`${p.label} task`}
                          />
                          <div className="min-w-0">
                            <p className="text-[13px] font-medium text-slate-800 dark:text-slate-100 truncate">
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
                        {/* Timeline cell — solid bar with the task name on it */}
                        <div
                          className="relative shrink-0 group-hover:bg-slate-50/60 dark:group-hover:bg-slate-800/60 border-b border-slate-100 dark:border-slate-800"
                          style={{ width: timelineW }}
                        >
                          <button
                            type="button"
                            onClick={() => onEditTask(task)}
                            title={`${task.name} · ${p.label} · ${task.startDate} → ${task.endDate} — click to edit`}
                            className="absolute top-1/2 -translate-y-1/2 h-[22px] rounded-md overflow-hidden shadow-sm ring-1 ring-black/10 hover:ring-2 hover:ring-slate-400 dark:hover:ring-slate-500 transition-all z-10 text-left"
                            style={{ left, width, backgroundColor: p.bar }}
                          >
                            {width >= 60 && (
                              <span className="absolute inset-0 flex items-center px-2 text-[11px] font-bold text-white whitespace-nowrap overflow-hidden drop-shadow-sm">
                                {task.name}
                              </span>
                            )}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </Fragment>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
