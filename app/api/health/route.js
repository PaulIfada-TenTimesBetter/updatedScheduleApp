import { NextResponse } from 'next/server';
import { checkDatabase } from '@/lib/store';

export const dynamic = 'force-dynamic';

export async function GET() {
  const result = await checkDatabase();
  const ok = result.database === 'connected' || result.mode === 'demo';
  return NextResponse.json(result, { status: ok ? 200 : 500 });
}
