// ---------------------------------------------------------------------------
// Progress Tracker snapshot export (PDF).
// buildTrackerSvg() renders the tracker — overall performance, each task's
// progress bar with %, its weight, and progress-status comments — as a clean
// SVG. downloadTrackerPdf() rasterizes it at 2x and saves a single-page PDF
// sized to the content. Client-side only; jsPDF is loaded on demand.
// ---------------------------------------------------------------------------
import { priorityOf } from './priority';

const ROW_H = 44;
const TITLE_H = 110;
const HEADER_H = 34;
const PAD = 24;
const COL = { num: 40, task: 300, weight: 76, progress: 240 };
const STATUS_W = 380;

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

function clampWeight(v) {
  return Math.max(1, Math.min(100, Math.round(Number(v) || 1)));
}

export function buildTrackerSvg({ tasks, title = 'Progress Tracker' }) {
  const W = PAD * 2 + COL.num + COL.task + COL.weight + COL.progress + STATUS_W;
  const tableTop = TITLE_H;
  const rowsTop = tableTop + HEADER_H;
  const H = rowsTop + tasks.length * ROW_H + PAD + 30;

  const totalWeight = tasks.reduce((s, t) => s + clampWeight(t.weight), 0);
  const weighted = totalWeight
    ? Math.round(tasks.reduce((s, t) => s + (t.progress || 0) * clampWeight(t.weight), 0) / totalWeight)
    : 0;

  const xNum = PAD;
  const xTask = xNum + COL.num;
  const xWeight = xTask + COL.task;
  const xProgress = xWeight + COL.weight;
  const xStatus = xProgress + COL.progress;

  const parts = [];
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="Arial, Helvetica, sans-serif">`
  );
  parts.push(`<rect x="0" y="0" width="${W}" height="${H}" fill="#ffffff"/>`);

  // Title + overall performance
  parts.push(
    `<text x="${PAD}" y="38" font-size="21" font-weight="bold" fill="#0f172a">${esc(title || 'Progress Tracker')}</text>`
  );
  parts.push(
    `<text x="${PAD}" y="62" font-size="12" font-weight="bold" letter-spacing="1" fill="#94a3b8">OVERALL PROJECT PERFORMANCE</text>`
  );
  const perfColor = weighted >= 70 ? '#059669' : weighted >= 40 ? '#d97706' : '#dc2626';
  parts.push(
    `<text x="${PAD}" y="60" font-size="12" font-weight="bold" letter-spacing="1" fill="#94a3b8">OVERALL PROJECT PERFORMANCE: <tspan fill="${perfColor}" font-size="15">${weighted}%</tspan></text>`
  );
  const barX = PAD;
  const barW = W - PAD * 2;
  parts.push(`<rect x="${barX}" y="70" width="${barW}" height="12" rx="6" fill="#e2e8f0"/>`);
  if (weighted > 0) {
    parts.push(`<rect x="${barX}" y="70" width="${((barW * weighted) / 100).toFixed(1)}" height="12" rx="6" fill="#6366f1"/>`);
  }
  parts.push(
    `<text x="${barX}" y="96" font-size="10" fill="#94a3b8">Weighted average across ${tasks.length} task${tasks.length === 1 ? '' : 's'}</text>`
  );

  // Table header
  parts.push(`<rect x="${PAD}" y="${tableTop}" width="${W - PAD * 2}" height="${HEADER_H}" fill="#f1f5f9"/>`);
  const headY = tableTop + 22;
  const heads = [
    [xNum + 12, '#'],
    [xTask + 14, (title || 'Task').toUpperCase()],
    [xWeight + COL.weight / 2, 'WEIGHT'],
    [xProgress + 14, 'PROGRESS'],
    [xStatus + 14, 'PROGRESS STATUS'],
  ];
  for (const [x, label] of heads) {
    const anchor = label === 'WEIGHT' ? 'middle' : 'start';
    parts.push(
      `<text x="${x}" y="${headY}" font-size="11" font-weight="bold" letter-spacing="1" fill="#64748b" text-anchor="${anchor}">${esc(label)}</text>`
    );
  }

  // Rows
  tasks.forEach((t, r) => {
    const p = priorityOf(t.priority);
    const y = rowsTop + r * ROW_H;
    if (r % 2 === 1) {
      parts.push(`<rect x="${PAD}" y="${y}" width="${W - PAD * 2}" height="${ROW_H}" fill="#f8fafc"/>`);
    }
    parts.push(
      `<line x1="${PAD}" y1="${y + ROW_H}" x2="${W - PAD}" y2="${y + ROW_H}" stroke="#e2e8f0"/>`
    );

    const cy = y + ROW_H / 2;
    parts.push(`<text x="${xNum + 12}" y="${cy + 4}" font-size="12" fill="#94a3b8">${r + 1}</text>`);
    parts.push(
      `<text x="${xTask + 14}" y="${cy + 4}" font-size="13" font-weight="bold" fill="#1e293b">${esc(truncate(t.name, 38))}</text>`
    );
    parts.push(
      `<text x="${xWeight + COL.weight / 2}" y="${cy + 4}" font-size="12" fill="#475569" text-anchor="middle">${clampWeight(t.weight)}</text>`
    );

    // progress bar with % inside
    const prog = Math.max(0, Math.min(100, t.progress || 0));
    const bw = COL.progress - 28;
    const bx = xProgress + 14;
    const by = cy - 11;
    parts.push(`<rect x="${bx}" y="${by}" width="${bw}" height="22" rx="5" fill="${p.bar}"/>`);
    if (prog > 0) {
      const pw = (bw * prog) / 100;
      parts.push(
        `<rect x="${bx}" y="${by}" width="${pw.toFixed(1)}" height="22" rx="5" fill="${p.fill}"/>`
      );
    }
    parts.push(
      `<text x="${bx + bw / 2}" y="${cy + 4}" font-size="10.5" font-weight="bold" fill="#ffffff" text-anchor="middle">${prog}%</text>`
    );

    // progress status comment
    parts.push(
      `<text x="${xStatus + 14}" y="${cy + 4}" font-size="12" fill="#475569">${esc(truncate(t.progressStatus || '—', 52))}</text>`
    );
  });

  // outer border
  parts.push(
    `<rect x="${PAD}" y="${tableTop}" width="${W - PAD * 2}" height="${HEADER_H + tasks.length * ROW_H}" fill="none" stroke="#cbd5e1"/>`
  );

  parts.push(
    `<text x="${W - PAD}" y="${H - 12}" font-size="11" font-weight="bold" fill="#94a3b8" text-anchor="end">TenTimesetter-Scheduler</text>`
  );
  parts.push('</svg>');

  return { svg: parts.join('\n'), width: W, height: H };
}

/** Builds the tracker SVG and downloads it as a single-page PDF. */
export async function downloadTrackerPdf({ tasks, title = 'Progress Tracker' }) {
  if (typeof document === 'undefined') return;
  if (!tasks.length) return;
  const { svg, width, height } = buildTrackerSvg({ tasks, title });

  // Rasterize the SVG at 2x for a crisp PDF.
  const svgBlob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(svgBlob);
  const img = new Image();
  img.onload = async () => {
    const scale = 2;
    const canvas = document.createElement('canvas');
    canvas.width = width * scale;
    canvas.height = height * scale;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    URL.revokeObjectURL(url);
    const dataUrl = canvas.toDataURL('image/png');

    const { jsPDF } = await import('jspdf');
    const pdf = new jsPDF({
      orientation: width >= height ? 'landscape' : 'portrait',
      unit: 'pt',
      format: [width, height],
      compress: true,
    });
    pdf.addImage(dataUrl, 'PNG', 0, 0, width, height);
    pdf.save(`tentimesetter-progress-${new Date().toISOString().slice(0, 10)}.pdf`);
  };
  img.src = url;
}
