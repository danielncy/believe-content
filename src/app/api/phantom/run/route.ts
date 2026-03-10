export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { runPhantom } from '@/agents/phantom';

export const maxDuration = 60;

export async function GET() {
  try {
    const result = await runPhantom();
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'PHANTOM run failed' },
      { status: 500 }
    );
  }
}
