import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { insertTask } from '@/lib/store';
import { isValidISODate } from '@/lib/dates';

const MAX_BULK = 500;

/** Bulk task creation — used by the Excel import. */
export async function POST(req) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const items = Array.isArray(body.tasks) ? body.tasks : [];
  if (!items.length) return NextResponse.json({ error: 'No tasks to import.' }, { status: 400 });
  if (items.length > MAX_BULK) {
    return NextResponse.json(
      { error: `Too many rows — the limit is ${MAX_BULK} tasks per import.` },
      { status: 400 }
    );
  }

  const created = [];
  const failed = [];
  for (const raw of items) {
    const name = String(raw?.name || '').trim().slice(0, 140);
    const startDate = String(raw?.startDate || '');
    const endDate = String(raw?.endDate || '');
    const priority = raw?.priority === 'critical' ? 'critical' : 'normal';
    const progress = Math.max(0, Math.min(100, Math.round(Number(raw?.progress) || 0)));
    const weight = Math.max(1, Math.min(100, Math.round(Number(raw?.weight) || 1)));

    if (!name || !isValidISODate(startDate) || !isValidISODate(endDate) || endDate < startDate) {
      failed.push({ name: name || '(unnamed row)', reason: 'invalid name or dates' });
      continue;
    }
    try {
      created.push(await insertTask({ userId: user.id, name, startDate, endDate, priority, progress, weight }));
    } catch (err) {
      console.error('[tasks:bulk]', err);
      failed.push({ name, reason: 'database error' });
    }
  }

  return NextResponse.json({ created, failed }, { status: created.length ? 201 : 400 });
}
