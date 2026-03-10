// PHANTOM — 2FA Verification Endpoint
// GET  /api/phantom/2fa — check if 2FA is required
// POST /api/phantom/2fa — submit 2FA code

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { loadTwoFAChallenge, submitTwoFACode } from '@/agents/phantom/poster';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET() {
  const challenge = await loadTwoFAChallenge();

  if (!challenge) {
    return NextResponse.json({ required: false });
  }

  // Check if challenge is expired (>15 min)
  const challengeAge = Date.now() - new Date(challenge.timestamp).getTime();
  const fifteenMinutes = 15 * 60 * 1000;

  if (challengeAge > fifteenMinutes) {
    return NextResponse.json({ required: false, expired: true });
  }

  return NextResponse.json({
    required: true,
    timestamp: challenge.timestamp,
  });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { code } = body as { code?: string };

  if (!code || !/^\d{6}$/.test(code)) {
    return NextResponse.json(
      { error: 'Invalid code — must be exactly 6 digits' },
      { status: 400 }
    );
  }

  const result = await submitTwoFACode(code);

  if (result.success) {
    // Reset all awaiting_2fa posts back to scheduled
    const supabase = createServiceClient();
    const { data: awaitingPosts } = await supabase
      .from('approved_posts')
      .select('id')
      .eq('status', 'awaiting_2fa');

    if (awaitingPosts && awaitingPosts.length > 0) {
      await supabase
        .from('approved_posts')
        .update({ status: 'scheduled' })
        .eq('status', 'awaiting_2fa');
    }

    return NextResponse.json({
      success: true,
      postsRescheduled: awaitingPosts?.length || 0,
    });
  }

  return NextResponse.json(
    { success: false, error: result.error },
    { status: 400 }
  );
}
