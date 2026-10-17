'use client';

import { useMemo, useRef, useState } from 'react';
import { todayISO, addDays, parseDate, diffDays } from '@/lib/dates';

const inputCls =
  'w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500';

function parseProgressValue(v) {
  if (v === null || v === undefined || v === '') return 0;
  const str = String(v).trim();
  const hadPercent = str.includes('%');
  const n = parseFloat(str.replace('%', ''));
  if (Number.isNaN(n)) return 0;
  let val = n;
  // 0.8 or "80%" -> 80 ; plain 80 -> 80 ; plain 0.8 without % -> 80
  if (val > 0 && val <= 1 && (!Number.isInteger(val) || hadPercent)) val = val * 100;
  return Math.max(0, Math.min(100, Math.round(val)));
}

function parseDateValue(v) {
  if (v === null || v === undefined || v === '') return null;
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    return v.toISOString().slice(0, 10);
  }
  const s = String(v).trim();
  // Excel serial number (e.g. 45291)
  if (/^\d{5}$/.test(s)) {
    const d = new Date(Date.UTC(1899, 11, 30) + Number(s) * 86400000);
    if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }
  const parsed = new Date(s);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  return null;
}

/** Count consecutive data-like rows directly beneath a candidate header row
 *  (allowing a single blank gap). This is what separates a real column-header
 *  row from title bands and label/value pairs higher up in the sheet. */
function countDataRowsBelow(aoa, idx, headerFilled) {
  const threshold = Math.max(2, Math.ceil(headerFilled * 0.75));
  let count = 0;
  let gapUsed = false;
  for (let i = idx + 1; i < Math.min(aoa.length, idx + 60); i++) {
    const row = aoa[i] || [];
    const filled = row.filter((c) => c !== null && c !== undefined && String(c).trim() !== '');
    if (filled.length >= threshold) {
      count++;
    } else if (!gapUsed && filled.length === 0) {
      gapUsed = true; // tolerate one blank row between the header and the data
    } else {
      break;
    }
  }
  return count;
}

/** Scan the first rows and pick the most likely header row. */
function detectTable(aoa) {
  let best = { idx: -1, score: -1 };
  const limit = Math.min(aoa.length, 12);
  for (let i = 0; i < limit; i++) {
    const row = aoa[i] || [];
    const filled = row.filter(
      (c) => c !== null && c !== undefined && String(c).trim() !== ''
    );
    if (filled.length < 2) continue;
    const textCells = filled.filter((c) => typeof c === 'string' && c.trim().length > 1);
    // A real header has data rows beneath it — weight that heavily so title
    // bands and merged labels above the table never win.
    const dataBelow = countDataRowsBelow(aoa, i, filled.length);
    const score = filled.length + textCells.length * 2 + Math.min(dataBelow, 10) * 3;
    if (score >= best.score) {
      best = { idx: i, score };
    }
  }
  if (best.idx === -1) return { header: [], rows: [] };
  const rawHeader = (aoa[best.idx] || []).map((c, i) =>
    c === null || c === undefined || String(c).trim() === '' ? `Column ${i + 1}` : String(c).trim()
  );
  const rows = aoa
    .slice(best.idx + 1)
    .map((r) => {
      const obj = {};
      rawHeader.forEach((h, i) => {
        obj[h] = r[i] ?? null;
      });
      return obj;
    })
    .filter((r) => Object.values(r).some((v) => v !== null && String(v).trim() !== ''));
  return { header: rawHeader, rows, headerRowIdx: best.idx };
}

function guessColumn(headers, patterns, exclude = []) {
  const candidates = headers.filter((h) => !exclude.includes(h));
  for (const p of patterns) {
    const hit = candidates.find((h) => p.test(h));
    if (hit) return hit;
  }
  return '';
}

function looksNumericish(v) {
  if (v === null || v === undefined || v === '') return false;
  if (typeof v === 'number') return true;
  const s = String(v).trim();
  if (!s) return false;
  return !Number.isNaN(parseFloat(s.replace('%', ''))) && /%|^\d|^-\d|^\.\d/.test(s);
}

/** Pick the progress column: name patterns first, but prefer columns whose
 *  data actually looks numeric/percent (so "Progress Status" comment columns
 *  lose to "CURRENT" or "Progress %" columns). */
function guessProgressColumn(headers, rows) {
  const patterns = [/%|percent/i, /current/i, /complet/i, /progress/i];
  let best = { col: '', score: -1 };
  for (let ci = 0; ci < headers.length; ci++) {
    const h = headers[ci];
    for (let pi = 0; pi < patterns.length; pi++) {
      if (patterns[pi].test(h)) {
        const values = rows
          .slice(0, 20)
          .map((r) => r[h])
          .filter((v) => v !== null && String(v).trim() !== '');
        const numeric = values.filter(looksNumericish).length;
        const dataScore = values.length && numeric / values.length >= 0.5 ? 5 : 0;
        const score = patterns.length - pi + dataScore;
        if (score > best.score) best = { col: h, score };
        break;
      }
    }
  }
  return best.col;
}

export default function ImportModal({ busy, error, onImport, onClose }) {
  const [sheetNames, setSheetNames] = useState([]);
  const [sheetIdx, setSheetIdx] = useState(0);
  const [sheets, setSheets] = useState([]); // [{header, rows}]
  const [taskCol, setTaskCol] = useState('');
  const [startCol, setStartCol] = useState('');
  const [endCol, setEndCol] = useState('');
  const [progressCol, setProgressCol] = useState('');
  const [fileName, setFileName] = useState('');
  const [localError, setLocalError] = useState('');
  const fileRef = useRef(null);

  const shownError = localError || error;
  const active = sheets[sheetIdx] || { header: [], rows: [] };

  const preview = useMemo(() => {
    return active.rows.slice(0, 5).map((r, i) => {
      const name = taskCol ? String(r[taskCol] ?? '').trim() : '';
      const start = startCol ? parseDateValue(r[startCol]) : null;
      const end = endCol ? parseDateValue(r[endCol]) : null;
      const progress = progressCol ? parseProgressValue(r[progressCol]) : 0;
      return { i, name, start, end, progress };
    });
  }, [active, taskCol, startCol, endCol, progressCol]);

  const mappedCount = useMemo(() => {
    if (!taskCol) return 0;
    return active.rows.filter((r) => String(r[taskCol] ?? '').trim() !== '').length;
  }, [active, taskCol]);

  async function onFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLocalError('');
    setFileName(file.name);
    try {
      const XLSX = await import('xlsx');
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { cellDates: true });
      const parsed = wb.SheetNames.map((name) => {
        const sheet = wb.Sheets[name];
        const aoa = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });
        const { header, rows } = detectTable(aoa);
        return { name, header, rows };
      });
      setSheetNames(parsed.map((p) => p.name));
      setSheets(parsed);
      setSheetIdx(0);

      // Smart guesses for the first sheet
      const { header } = parsed[0];
      setTaskCol(guessColumn(header, [/task/i, /activit/i, /description/i, /item/i, /wbs/i]));
      setStartCol(guessColumn(header, [/start/i, /begin/i, /from/i]));
      setEndCol(guessColumn(header, [/end/i, /finish/i, /due/i, /to$/i]));
      setProgressCol(guessProgressColumn(header, parsed[0].rows));
    } catch (err) {
      console.error('[import]', err);
      setLocalError('Could not read that file. Use .xlsx, .xls or .csv.');
    }
  }

  function switchSheet(idx) {
    setSheetIdx(idx);
    const { header } = sheets[idx];
    setTaskCol(guessColumn(header, [/task/i, /activit/i, /description/i, /item/i, /wbs/i]));
    setStartCol(guessColumn(header, [/start/i, /begin/i, /from/i]));
    setEndCol(guessColumn(header, [/end/i, /finish/i, /due/i, /to$/i]));
    setProgressCol(guessProgressColumn(header, sheets[idx].rows));
  }

  function buildTasks() {
    const base = todayISO();
    return active.rows
      .map((r) => String(r[taskCol] ?? '').trim())
      .filter(Boolean)
      .map((name, i) => {
        let start = startCol ? parseDateValue(active.rows.filter((r) => String(r[taskCol] ?? '').trim() !== '')[i]?.[startCol]) : null;
        let end = endCol ? parseDateValue(active.rows.filter((r) => String(r[taskCol] ?? '').trim() !== '')[i]?.[endCol]) : null;
        const progress = progressCol
          ? parseProgressValue(active.rows.filter((r) => String(r[taskCol] ?? '').trim() !== '')[i]?.[progressCol])
          : 0;
        if (!start) start = addDaysStr(base, i * 3);
        if (!end || end < start) end = addDaysStr(start, 2);
        return { name: name.slice(0, 140), startDate: start, endDate: end, priority: 'normal', progress, weight: 1 };
      });
  }

  function addDaysStr(iso, n) {
    const d = parseDate(iso);
    return new Date(d.getTime() + n * 86400000).toISOString().slice(0, 10);
  }

  function onSubmit(e) {
    e.preventDefault();
    setLocalError('');
    if (!taskCol) {
      setLocalError('Choose which column contains the task names.');
      return;
    }
    const tasks = buildTasks();
    if (!tasks.length) {
      setLocalError('No task names found in that column.');
      return;
    }
    onImport(tasks);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60"
      onMouseDown={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 shadow-2xl p-6 max-h-[92vh] overflow-auto"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
            Import tasks from Excel
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xl leading-none px-1"
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Upload an .xlsx, .xls or .csv file. You choose which column holds the task names —
          dates and progress columns are optional.
        </p>

        <form onSubmit={onSubmit} className="mt-4 space-y-4">
          {shownError && (
            <p className="rounded-lg bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm px-3 py-2">
              {shownError}
            </p>
          )}

          {/* File picker */}
          <div>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={onFileChange}
              className="hidden"
              id="import-file"
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="w-full rounded-lg border-2 border-dashed border-slate-300 dark:border-slate-600 hover:border-indigo-400 dark:hover:border-indigo-500 px-4 py-6 text-center"
            >
              <span className="text-2xl">📄</span>
              <span className="block mt-1 text-sm font-semibold text-slate-700 dark:text-slate-200">
                {fileName || 'Click to choose a spreadsheet'}
              </span>
              {fileName && (
                <span className="block mt-1 text-xs text-slate-400">Click again to change the file</span>
              )}
            </button>
          </div>

          {sheets.length > 0 && (
            <>
              {sheetNames.length > 1 && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">
                    Sheet
                  </label>
                  <select
                    value={sheetIdx}
                    onChange={(e) => switchSheet(Number(e.target.value))}
                    className={inputCls}
                  >
                    {sheetNames.map((n, i) => (
                      <option key={i} value={i}>
                        {n} ({sheets[i].rows.length} rows)
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">
                    Task name column <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={taskCol}
                    onChange={(e) => setTaskCol(e.target.value)}
                    className={inputCls}
                    required
                  >
                    <option value="">— choose the column with the task names —</option>
                    {active.header.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">
                    Start date column <span className="font-normal text-slate-400">(optional)</span>
                  </label>
                  <select
                    value={startCol}
                    onChange={(e) => setStartCol(e.target.value)}
                    className={inputCls}
                  >
                    <option value="">— none —</option>
                    {active.header.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">
                    End date column <span className="font-normal text-slate-400">(optional)</span>
                  </label>
                  <select
                    value={endCol}
                    onChange={(e) => setEndCol(e.target.value)}
                    className={inputCls}
                  >
                    <option value="">— none —</option>
                    {active.header.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">
                    Progress column <span className="font-normal text-slate-400">(optional — accepts 0–100 or %)</span>
                  </label>
                  <select
                    value={progressCol}
                    onChange={(e) => setProgressCol(e.target.value)}
                    className={inputCls}
                  >
                    <option value="">— none —</option>
                    {active.header.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Preview */}
              {taskCol && (
                <div className="rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
                  <div className="bg-slate-50 dark:bg-slate-800 px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Preview — first {Math.min(5, preview.length)} of {mappedCount} task
                    {mappedCount === 1 ? '' : 's'} found
                  </div>
                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {preview.map((p) => (
                      <div key={p.i} className="px-3 py-2 text-sm flex items-center gap-2">
                        <span className="w-6 text-slate-400">{p.i + 1}.</span>
                        <span className="flex-1 truncate font-medium text-slate-800 dark:text-slate-100">
                          {p.name || <em className="text-slate-400">(skipped — empty)</em>}
                        </span>
                        <span className="text-xs text-slate-400">
                          {p.start ? p.start : 'auto'} → {p.end ? p.end : 'auto'} · {p.progress}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <p className="text-xs text-slate-400">
                No date columns mapped? Tasks are scheduled sequentially (3 days each starting
                today) — you can edit any task&apos;s dates afterwards.
              </p>
            </>
          )}

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="text-sm font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-800 dark:hover:text-slate-100 px-4 py-2"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy || !sheets.length || !taskCol}
              className="rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold text-sm px-5 py-2"
            >
              {busy ? 'Importing…' : `Import${mappedCount ? ` ${mappedCount} tasks` : ''}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
