// PHANTOM — Facebook Auto-Posting
// Orchestrator: fetch scheduled approved posts → post via Playwright → update DB
// Supports interactive 2FA: pauses queue when Facebook requires verification

import { createServiceClient } from '@/lib/supabase';
import { phantomLog } from './logger';
import { postToFacebook, loadTwoFAChallenge } from './poster';
import type { GeneratedContent } from '@/types/database';

export const AGENT_NAME = 'PHANTOM' as const;

export interface PhantomRunResult {
  posts_attempted: number;
  posts_published: number;
  posts_failed: number;
  posts_awaiting_2fa: number;
  errors: string[];
  duration_ms: number;
}

export async function runPhantom(): Promise<PhantomRunResult> {
  const startTime = Date.now();
  const supabase = createServiceClient();
  const sessionId = crypto.randomUUID();
  const errors: string[] = [];
  let published = 0;
  let failed = 0;
  let awaiting2fa = 0;

  phantomLog('info', 'Starting PHANTOM run', { sessionId });

  try {
    // 0. Pre-flight: check for active 2FA challenge
    const existingChallenge = await loadTwoFAChallenge();
    if (existingChallenge) {
      const challengeAge = Date.now() - new Date(existingChallenge.timestamp).getTime();
      const fifteenMinutes = 15 * 60 * 1000;

      if (challengeAge < fifteenMinutes) {
        phantomLog('warn', '2FA challenge is active — skipping this run', {
          challengeAge: Math.round(challengeAge / 1000) + 's',
        });

        // Set any scheduled posts to awaiting_2fa
        const { data: scheduledPosts } = await supabase
          .from('approved_posts')
          .select('id')
          .eq('status', 'scheduled');

        if (scheduledPosts && scheduledPosts.length > 0) {
          await supabase
            .from('approved_posts')
            .update({ status: 'awaiting_2fa' })
            .eq('status', 'scheduled');
          awaiting2fa = scheduledPosts.length;
        }

        return {
          posts_attempted: 0,
          posts_published: 0,
          posts_failed: 0,
          posts_awaiting_2fa: awaiting2fa,
          errors: ['2FA verification required — enter code in STAGE dashboard'],
          duration_ms: Date.now() - startTime,
        };
      } else {
        phantomLog('info', '2FA challenge expired (>15 min), proceeding normally');
      }
    }

    // 1. Reset stale 'publishing' posts (stuck > 10 min)
    const staleThreshold = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { data: stalePosts } = await supabase
      .from('approved_posts')
      .select('id')
      .eq('status', 'publishing')
      .lt('updated_at', staleThreshold);

    if (stalePosts && stalePosts.length > 0) {
      phantomLog('warn', `Resetting ${stalePosts.length} stale publishing posts`);
      await supabase
        .from('approved_posts')
        .update({ status: 'scheduled', error_message: 'Reset from stale publishing state' })
        .eq('status', 'publishing')
        .lt('updated_at', staleThreshold);
    }

    // 2. Fetch scheduled posts (oldest first, 1 per run to look natural)
    const { data: scheduledPosts, error: fetchError } = await supabase
      .from('approved_posts')
      .select(`
        *,
        generated_content:generated_content_id (
          id,
          generated_text,
          generated_image_url
        )
      `)
      .eq('status', 'scheduled')
      .order('created_at', { ascending: true })
      .limit(1);

    if (fetchError) {
      const msg = `Failed to fetch scheduled posts: ${fetchError.message}`;
      phantomLog('error', msg);
      return { posts_attempted: 0, posts_published: 0, posts_failed: 0, posts_awaiting_2fa: 0, errors: [msg], duration_ms: Date.now() - startTime };
    }

    if (!scheduledPosts || scheduledPosts.length === 0) {
      phantomLog('info', 'No scheduled posts to publish');
      return { posts_attempted: 0, posts_published: 0, posts_failed: 0, posts_awaiting_2fa: 0, errors: [], duration_ms: Date.now() - startTime };
    }

    phantomLog('info', `Found ${scheduledPosts.length} scheduled posts`);

    // 3. Process each post
    for (const post of scheduledPosts) {
      const content = post.generated_content as GeneratedContent | null;

      if (!content) {
        const msg = `No generated content for approved post ${post.id}`;
        phantomLog('error', msg);
        errors.push(msg);
        await supabase
          .from('approved_posts')
          .update({ status: 'failed', error_message: msg, phantom_session_id: sessionId })
          .eq('id', post.id);
        failed++;
        continue;
      }

      // 3a. Mark as publishing
      await supabase
        .from('approved_posts')
        .update({ status: 'publishing', phantom_session_id: sessionId })
        .eq('id', post.id);

      // 3b. Post to Facebook
      const result = await postToFacebook({
        text: content.generated_text,
        imageUrl: content.generated_image_url,
      });

      // 3c. Handle 2FA_REQUIRED — pause entire queue
      if (!result.success && result.error === '2FA_REQUIRED') {
        phantomLog('warn', '2FA required — pausing all scheduled posts');

        // Set current post to awaiting_2fa
        await supabase
          .from('approved_posts')
          .update({ status: 'awaiting_2fa' })
          .eq('id', post.id);
        awaiting2fa++;

        // Set all remaining scheduled posts to awaiting_2fa
        const { data: remaining } = await supabase
          .from('approved_posts')
          .select('id')
          .eq('status', 'scheduled');

        if (remaining && remaining.length > 0) {
          await supabase
            .from('approved_posts')
            .update({ status: 'awaiting_2fa' })
            .eq('status', 'scheduled');
          awaiting2fa += remaining.length;
        }

        errors.push('2FA verification required — enter code in STAGE dashboard');
        break;
      }

      if (result.success) {
        // 3d. Mark as published
        await supabase
          .from('approved_posts')
          .update({
            status: 'published',
            published_at: new Date().toISOString(),
            published_url: result.publishedUrl,
          })
          .eq('id', post.id);

        published++;
        phantomLog('info', 'Post published', { postId: post.id, fbPostId: result.postId });
      } else {
        // 3e. Mark as failed
        await supabase
          .from('approved_posts')
          .update({
            status: 'failed',
            error_message: result.error || 'Unknown error',
          })
          .eq('id', post.id);

        failed++;
        errors.push(`Post ${post.id}: ${result.error}`);
        phantomLog('error', 'Post failed', { postId: post.id, error: result.error });
      }
    }
  } catch (err) {
    const msg = `PHANTOM run failed: ${err instanceof Error ? err.message : String(err)}`;
    phantomLog('error', msg);
    errors.push(msg);
  }

  const runResult: PhantomRunResult = {
    posts_attempted: published + failed,
    posts_published: published,
    posts_failed: failed,
    posts_awaiting_2fa: awaiting2fa,
    errors,
    duration_ms: Date.now() - startTime,
  };

  phantomLog('info', 'PHANTOM run complete', runResult as unknown as Record<string, unknown>);
  return runResult;
}
