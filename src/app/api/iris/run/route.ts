// IRIS — Manual Trigger Endpoint
// GET /api/iris/run — picks top scraped post, rewrites in Daniel's voice

import { NextResponse } from 'next/server';
import { runIris } from '@/agents/iris';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const maxDuration = 60;

export async function GET() {
  const result = await runIris();

  return NextResponse.json(result, {
    status: result.success ? 200 : 500,
  });
}
