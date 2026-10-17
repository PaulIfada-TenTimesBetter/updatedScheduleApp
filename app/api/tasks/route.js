import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { listTasks, insertTask } from '@/lib/store';
import { isValidISODate } from '@/lib/dates';

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  const tasks = await listTasks(user.id);
  return NextResponse.json({ tasks });
}

export async function POST(req) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const result = validateTaskBody(body);
  if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });

  try {
    const task = await insertTask({ userId: user.id, ...result.value });
    return NextResponse.json({ task }, { status: 201 });
  } catch (err) {
    console.error('[tasks:create]', err);
    return NextResponse.json({ error: 'Could not save the task.' }, { status: 500 });
  }
}

function validateTaskBody(body) {
  const name = String(body.name || '').trim();
  const startDate = String(body.startDate || '');
  const endDate = String(body.endDate || '');
  const priority = body.priority === 'critical' ? 'critical' : 'normal';
  const progress = Math.max(0, Math.min(100, Math.round(Number(body.progress) || 0)));

  if (!name) return { error: 'Task name is required.' };
  if (!isValidISODate(startDate) || !isValidISODate(endDate)) {
    return { error: 'Please provide a valid start and end date.' };
  }
  if (endDate < startDate) return { error: 'End date cannot be before the start date.' };

  return { value: { name: name.slice(0, 140), startDate, endDate, priority, progress } };
}
