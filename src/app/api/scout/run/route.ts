export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { runScout } from '@/agents/scout';

export async function GET() {
  try {
    const result = await runScout();
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'SCOUT run failed' },
      { status: 500 }
    );
  }
}
