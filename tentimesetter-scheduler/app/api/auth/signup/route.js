import { NextResponse } from 'next/server';
import {
  hashPassword,
  createSessionToken,
  SESSION_COOKIE,
  sessionCookieOptions,
  publicUser,
} from '@/lib/auth';
import { findUserByEmail, insertUser } from '@/lib/store';

export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const name = String(body.name || '').trim().slice(0, 80);
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters long.' },
        { status: 400 }
      );
    }
    if (await findUserByEmail(email)) {
      return NextResponse.json(
        { error: 'An account with this email already exists. Try logging in instead.' },
        { status: 409 }
      );
    }

    const user = await insertUser({
      email,
      name,
      passwordHash: await hashPassword(password),
    });

    const token = await createSessionToken(user.id, user.email);
    const res = NextResponse.json({ user: publicUser(user) }, { status: 201 });
    res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
    return res;
  } catch (err) {
    if (err.code === 'DUPLICATE_EMAIL') {
      return NextResponse.json(
        { error: 'An account with this email already exists. Try logging in instead.' },
        { status: 409 }
      );
    }
    console.error('[signup]', err);
    return NextResponse.json(
      { error: 'Could not create your account. Please try again.' },
      { status: 500 }
    );
  }
}
