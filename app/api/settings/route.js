import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { getSettings, upsertSettings } from '@/lib/store';
import { isValidISODate } from '@/lib/dates';

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  const settings = await getSettings(user.id);
  return NextResponse.json({ settings });
}

export async function PUT(req) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const projectTitle = String(body.projectTitle ?? '').trim().slice(0, 140);
  const projectStart = body.projectStart ? String(body.projectStart) : null;
  const projectEnd = body.projectEnd ? String(body.projectEnd) : null;
  const meetingEnabled = body.meetingEnabled === true;
  const meetingLabel = String(body.meetingLabel ?? '').trim().slice(0, 40);

  if (projectStart && !isValidISODate(projectStart)) {
    return NextResponse.json({ error: 'Invalid project start date.' }, { status: 400 });
  }
  if (projectEnd && !isValidISODate(projectEnd)) {
    return NextResponse.json({ error: 'Invalid project end date.' }, { status: 400 });
  }
  if (projectStart && projectEnd && projectEnd < projectStart) {
    return NextResponse.json(
      { error: 'Project end date cannot be before the start date.' },
      { status: 400 }
    );
  }

  try {
    const settings = await upsertSettings(user.id, {
      projectTitle, projectStart, projectEnd, meetingEnabled, meetingLabel,
    });
    return NextResponse.json({ settings });
  } catch (err) {
    console.error('[settings]', err);
    return NextResponse.json({ error: 'Could not save settings.' }, { status: 500 });
  }
}
