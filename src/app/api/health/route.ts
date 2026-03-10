export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    app: 'believe-content',
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
}
