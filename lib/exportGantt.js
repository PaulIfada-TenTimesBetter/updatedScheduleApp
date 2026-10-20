// ---------------------------------------------------------------------------
// Gantt snapshot export.
// buildGanttSvg() renders the timeline as a clean, standalone SVG string
// (title, date header, bars, legend). downloadGanttPng() turns that SVG into
// a high-resolution PNG and triggers a download. Everything runs client-side.
// ---------------------------------------------------------------------------
import { parseDate, addDays, diffDays, todayISO, formatDateShort } from './dates';
import { priorityOf } from './priority';

const ROW_H = 44;
const MONTH_H = 26;
const DAY_H = 30;
const SIDEBAR = 320;
const PAD_X = 28;
const TITLE_H = 66;
const FOOTER_H = 56;
const ZOOMS = { day: 36, week: 12, month: 3.5 };
const ZOOM_LABELS = { day: 'Day', week: 'Week', month: 'Month' };

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function truncate(s, n) {
  s = String(s || '');
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}

export function buildGanttSvg({
  tasks,
  zoom = 'day',
  title = 'Project Schedule',
  sidebarLabel = 'Task',
  projectStart,
  projectEnd,
}) {
  const dayWidth = ZOOMS[zoom] || ZOOMS.day;

  // --- date range (mirrors the on-screen chart) ---
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
  const taskMin = min;
  const taskMax = max;
  const start = addDays(min, -2);
  let end = addDays(max, 3);
  if (diffDays(start, end) < 20) end = addDays(start, 20);
  const days = Array.from({ length: diffDays(start, end) + 1 }, (_, i) => addDays(start, i));

  // --- month segments ---
  const months = [];
  days.forEach((d, i) => {
    const key = `${d.getUTCFullYear()}-${d.getUTCMonth()}`;
    const last = months[months.length - 1];
    if (!last || last.key !== key) {
      months.push({
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

  // --- layout ---
  const timelineW = days.length * dayWidth;
  const W = PAD_X * 2 + SIDEBAR + timelineW;
  const chartX = PAD_X;
  const chartTop = TITLE_H;
  const rowsTop = chartTop + MONTH_H + DAY_H;
  const bodyH = tasks.length * ROW_H;
  const rowsEnd = rowsTop + bodyH;
  const footerTop = rowsEnd + 16;
  const H = footerTop + FOOTER_H;

  const parts = [];
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="Arial, Helvetica, sans-serif">`
  );
  parts.push(`<rect x="0" y="0" width="${W}" height="${H}" fill="#ffffff"/>`);

  // --- title block ---
  const totalDays = diffDays(taskMin, taskMax) + 1;
  const weeks = Math.max(1, Math.round(totalDays / 7));
  let subtitle = `${formatDateShort(taskMin.toISOString().slice(0, 10))} → ${formatDateShort(
    taskMax.toISOString().slice(0, 10)
  )} · ${weeks} week${weeks === 1 ? '' : 's'} · ${ZOOM_LABELS[zoom] || 'Day'} view · ${tasks.length} task${tasks.length === 1 ? '' : 's'}`;
  if (projectStart && projectEnd) {
    subtitle = `Project duration: ${formatDateShort(projectStart)} → ${formatDateShort(projectEnd)} · ${subtitle}`;
  }
  parts.push(
    `<text x="${PAD_X}" y="34" font-size="21" font-weight="bold" fill="#0f172a">${esc(title)}</text>`
  );
  parts.push(`<text x="${PAD_X}" y="56" font-size="13" fill="#64748b">${esc(subtitle)}</text>`);

  // --- weekend shading behind the rows ---
  if (dayWidth >= 14) {
    days.forEach((d, i) => {
      const wd = d.getUTCDay();
      if (wd !== 0 && wd !== 6) return;
      const x = chartX + SIDEBAR + i * dayWidth;
      parts.push(
        `<rect x="${x}" y="${rowsTop}" width="${dayWidth}" height="${bodyH}" fill="#f1f5f9"/>`
      );
    });
  }

  // --- month band ---
  months.forEach((m) => {
    const x = chartX + SIDEBAR + m.startIdx * dayWidth;
    const w = m.days * dayWidth;
    parts.push(
      `<rect x="${x}" y="${chartTop}" width="${w}" height="${MONTH_H}" fill="#ffffff" stroke="#e2e8f0"/>`
    );
    const label = w > 84 ? m.label : w > 26 ? m.short : '';
    if (label) {
      parts.push(
        `<text x="${x + 8}" y="${chartTop + 17}" font-size="12" font-weight="bold" fill="#334155">${esc(label)}</text>`
      );
    }
  });

  // --- day band ---
  const dayY = chartTop + MONTH_H;
  parts.push(
    `<rect x="${chartX}" y="${dayY}" width="${SIDEBAR}" height="${DAY_H}" fill="#f8fafc" stroke="#e2e8f0"/>`
  );
  parts.push(
    `<text x="${chartX + 14}" y="${dayY + 19}" font-size="11" font-weight="bold" letter-spacing="1" fill="#94a3b8">${esc(
      (sidebarLabel || 'Task').toUpperCase()
    )}</text>`
  );

  if (dayWidth >= 24) {
    days.forEach((d, i) => {
      const x = chartX + SIDEBAR + i * dayWidth;
      const wd = d.getUTCDay();
      const weekend = wd === 0 || wd === 6;
      const fill = weekend ? '#f1f5f9' : '#ffffff';
      parts.push(
        `<rect x="${x}" y="${dayY}" width="${dayWidth}" height="${DAY_H}" fill="${fill}" stroke="#e2e8f0"/>`
      );
      parts.push(
        `<text x="${x + dayWidth / 2}" y="${dayY + 14}" font-size="11" font-weight="bold" fill="#475569" text-anchor="middle">${d.getUTCDate()}</text>`
      );
      parts.push(
        `<text x="${x + dayWidth / 2}" y="${dayY + 25}" font-size="8.5" fill="#94a3b8" text-anchor="middle">${esc(
          d.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' }).slice(0, 2)
        )}</text>`
      );
    });
  } else {
    parts.push(
      `<rect x="${chartX + SIDEBAR}" y="${dayY}" width="${timelineW}" height="${DAY_H}" fill="#ffffff" stroke="#e2e8f0"/>`
    );
    days.forEach((d, i) => {
      const x = chartX + SIDEBAR + i * dayWidth;
      const showWeek = dayWidth >= 8 && d.getUTCDay() === 1;
      const showMonth = dayWidth < 8 && d.getUTCDate() === 1;
      if (!showWeek && !showMonth) return;
      parts.push(`<line x1="${x}" y1="${dayY}" x2="${x}" y2="${rowsEnd}" stroke="#cbd5e1"/>`);
      parts.push(
        `<text x="${x + 5}" y="${dayY + 18}" font-size="10" fill="#64748b">${
          showWeek
            ? esc(d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }))
            : esc(d.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' }))
        }</text>`
      );
    });
  }

  // --- day grid lines in the rows area ---
  if (dayWidth >= 24) {
    days.forEach((d, i) => {
      const x = chartX + SIDEBAR + i * dayWidth;
      parts.push(`<line x1="${x}" y1="${rowsTop}" x2="${x}" y2="${rowsEnd}" stroke="#eef2f7"/>`);
    });
  }

  // --- rows ---
  tasks.forEach((t) => {
    const p = priorityOf(t.priority);
    const y = rowsTop + tasks.indexOf(t) * ROW_H;
    parts.push(
      `<line x1="${chartX}" y1="${y + ROW_H}" x2="${chartX + SIDEBAR + timelineW}" y2="${y + ROW_H}" stroke="#e2e8f0"/>`
    );

    const dotCx = chartX + 16;
    const textX = chartX + 28;
    parts.push(`<circle cx="${dotCx}" cy="${y + 16}" r="4" fill="${p.dot}"/>`);
    parts.push(
      `<text x="${textX}" y="${y + 20}" font-size="13" font-weight="bold" fill="#1e293b">${esc(truncate(t.name, 26))}</text>`
    );
    parts.push(
      `<text x="${textX}" y="${y + 35}" font-size="10" fill="#94a3b8">${formatDateShort(t.startDate)} – ${formatDateShort(t.endDate)}</text>`
    );
    parts.push(
      `<text x="${chartX + SIDEBAR - 14}" y="${y + 19}" font-size="9" font-weight="bold" letter-spacing="0.5" fill="${p.bar}" text-anchor="end">${p.label.toUpperCase()}</text>`
    );

    // bar
    const s = parseDate(t.startDate);
    const e = parseDate(t.endDate);
    const left = Math.max(0, diffDays(start, s)) * dayWidth + 2;
    const width = Math.max(8, (diffDays(s, e) + 1) * dayWidth - 4);
    const bx = chartX + SIDEBAR + left;
    const by = y + (ROW_H - 22) / 2;

    parts.push(`<rect x="${bx}" y="${by}" width="${width}" height="22" rx="5" fill="${p.bar}"/>`);
    if (width >= 60) {
      parts.push(
        `<text x="${bx + 8}" y="${by + 15}" font-size="11" font-weight="bold" fill="#ffffff">${esc(truncate(t.name, Math.max(6, Math.floor(width / 7))))}</text>`
      );
    }
  });

  // outer border
  parts.push(
    `<rect x="${chartX}" y="${chartTop}" width="${SIDEBAR + timelineW}" height="${MONTH_H + DAY_H + bodyH}" fill="none" stroke="#cbd5e1"/>`
  );

  // --- footer / legend ---
  const ly = footerTop + 24;
  let lx = PAD_X;
  parts.push(
    `<text x="${lx}" y="${ly}" font-size="10" font-weight="bold" letter-spacing="1" fill="#94a3b8">LEGEND</text>`
  );
  lx += 62;
  const items = [
    { swatch: 'rect', color: '#ef4444', label: 'Critical task', w: 76 },
    { swatch: 'rect', color: '#3b82f6', label: 'Normal task', w: 70 },
  ];
  for (const it of items) {
    if (it.swatch === 'rect') {
      parts.push(`<rect x="${lx}" y="${ly - 9}" width="16" height="10" rx="2" fill="${it.color}"/>`);
    } else {
      parts.push(`<rect x="${lx}" y="${ly - 9}" width="16" height="10" rx="2" fill="#3b82f6"/>`);
      parts.push(`<rect x="${lx + 0.5}" y="${ly - 8.5}" width="7.5" height="9" fill="#1e40af"/>`);
    }
    parts.push(`<text x="${lx + 21}" y="${ly}" font-size="11" fill="#475569">${esc(it.label)}</text>`);
    lx += 21 + it.w + 22;
  }
  parts.push(
    `<text x="${W - PAD_X}" y="${ly}" font-size="11" font-weight="bold" fill="#94a3b8" text-anchor="end">TenTimesBetter-Scheduler</text>`
  );

  parts.push('</svg>');
  return { svg: parts.join('\n'), width: W, height: H };
}

/** Renders the SVG to a 2x-resolution PNG and downloads it. Client-side only. */
export function downloadGanttPng(options) {
  if (typeof document === 'undefined') return;
  const { svg, width, height } = buildGanttSvg(options);

  const svgBlob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(svgBlob);
  const img = new Image();
  img.onload = () => {
    const scale = 2;
    const canvas = document.createElement('canvas');
    canvas.width = width * scale;
    canvas.height = height * scale;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    URL.revokeObjectURL(url);
    canvas.toBlob((pngBlob) => {
      if (!pngBlob) return;
      const a = document.createElement('a');
      const objectUrl = URL.createObjectURL(pngBlob);
      a.href = objectUrl;
      a.download = `TenTimesBetter-schedule-${todayISO()}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(objectUrl), 5000);
    }, 'image/png');
  };
  img.src = url;
}
