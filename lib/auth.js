import bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { findUserById } from '@/lib/store';

export const SESSION_COOKIE = 'tt_session';
const SESSION_DAYS = 7;

function secretKey() {
  if (!process.env.AUTH_SECRET) {
    // Dev/preview fallback — set AUTH_SECRET in production (see README).
    console.warn('[auth] AUTH_SECRET is not set — using an insecure dev secret.');
    return new TextEncoder().encode('dev-insecure-secret-change-me');
  }
  return new TextEncoder().encode(process.env.AUTH_SECRET);
}

export async function hashPassword(password) {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}

export async function createSessionToken(userId, email) {
  return new SignJWT({ email })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(secretKey());
}

export async function readSessionToken(token) {
  try {
    const { payload } = await jwtVerify(token, secretKey());
    return payload;
  } catch {
    return null;
  }
}

export function sessionCookieOptions(maxAgeSeconds = SESSION_DAYS * 24 * 60 * 60) {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: maxAgeSeconds,
  };
}

/** Returns the logged-in user (row from DB) or null. Server-side only. */
export async function getSessionUser() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const payload = await readSessionToken(token);
  if (!payload?.sub) return null;
  return findUserById(payload.sub);
}

export function publicUser(user) {
  return { id: user.id, email: user.email, name: user.name || '' };
}
