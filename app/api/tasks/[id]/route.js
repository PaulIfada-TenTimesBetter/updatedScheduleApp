import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { updateTask, deleteTask } from '@/lib/store';
import { isValidISODate } from '@/lib/dates';

export async function PATCH(req, { params }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  const fields = {};
  if (body.name !== undefined) {
    const name = String(body.name).trim();
    if (!name) return NextResponse.json({ error: 'Task name is required.' }, { status: 400 });
    fields.name = name.slice(0, 140);
  }
  if (body.startDate !== undefined) {
    if (!isValidISODate(String(body.startDate))) {
      return NextResponse.json({ error: 'Invalid start date.' }, { status: 400 });
    }
    fields.startDate = String(body.startDate);
  }
  if (body.endDate !== undefined) {
    if (!isValidISODate(String(body.endDate))) {
      return NextResponse.json({ error: 'Invalid end date.' }, { status: 400 });
    }
    fields.endDate = String(body.endDate);
  }
  if (body.priority !== undefined) {
    fields.priority = body.priority === 'critical' ? 'critical' : 'normal';
  }
  if (body.progress !== undefined) {
    fields.progress = Math.max(0, Math.min(100, Math.round(Number(body.progress) || 0)));
  }
  if (body.weight !== undefined) {
    fields.weight = Math.max(1, Math.min(100, Math.round(Number(body.weight) || 1)));
  }
  if (body.progressStatus !== undefined) {
    fields.progressStatus = String(body.progressStatus).trim().slice(0, 500);
  }
  if (body.section !== undefined) {
    fields.section = String(body.section).trim().slice(0, 120);
  }
  if (!Object.keys(fields).length) {
    return NextResponse.json({ error: 'Nothing to update.' }, { status: 400 });
  }
  if (fields.startDate && fields.endDate && fields.endDate < fields.startDate) {
    return NextResponse.json({ error: 'End date cannot be before the start date.' }, { status: 400 });
  }

  try {
    const task = await updateTask(user.id, id, fields);
    if (!task) return NextResponse.json({ error: 'Task not found.' }, { status: 404 });
    return NextResponse.json({ task });
  } catch (err) {
    console.error('[tasks:update]', err);
    return NextResponse.json({ error: 'Could not update the task.' }, { status: 500 });
  }
}

export async function DELETE(req, { params }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });

  const { id } = await params;
  try {
    const deleted = await deleteTask(user.id, id);
    if (!deleted) return NextResponse.json({ error: 'Task not found.' }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[tasks:delete]', err);
    return NextResponse.json({ error: 'Could not delete the task.' }, { status: 500 });
  }
}
