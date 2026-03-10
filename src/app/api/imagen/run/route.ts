// IMAGEN — Image Generation Trigger Endpoint
// GET /api/imagen/run — generates images for pending content

import { NextResponse } from 'next/server';
import { runImagen } from '@/agents/imagen';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const maxDuration = 120;

export async function GET() {
  const result = await runImagen();

  const hasErrors = result.errors.length > 0 && result.images_generated === 0;
  return NextResponse.json(result, {
    status: hasErrors ? 500 : 200,
  });
}
