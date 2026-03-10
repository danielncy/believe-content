// IRIS — AI Intelligence & Voice
// Orchestrator: picks top scraped post → rewrites in Daniel's voice → saves to generated_content

import { createServiceClient } from '@/lib/supabase';
import { irisLog } from './logger';
import { rewritePost } from './rewriter';
import type { ScrapedPost, VoiceSample, GeneratedContentInsert } from '@/types/database';

export const AGENT_NAME = 'IRIS' as const;

export interface IrisRunResult {
  success: boolean;
  post_id: string | null;
  generated_content_id: string | null;
  engagement_score: number | null;
  duration_ms: number;
  rewritten_text?: string;
  image_prompt?: string;
  error?: string;
}

export async function runIris(): Promise<IrisRunResult> {
  const start = Date.now();
  const supabase = createServiceClient();

  try {
    // 1. Fetch top unprocessed scraped post by engagement score
    irisLog('info', 'Fetching top scraped post');
    const { data: post, error: postError } = await supabase
      .from('scraped_posts')
      .select('*')
      .eq('status', 'new')
      .order('engagement_score', { ascending: false })
      .limit(1)
      .single();

    if (postError || !post) {
      irisLog('warn', 'No new scraped posts found', { error: postError?.message });
      return {
        success: false,
        post_id: null,
        generated_content_id: null,
        engagement_score: null,
        duration_ms: Date.now() - start,
        error: 'No new scraped posts available',
      };
    }

    const scrapedPost = post as ScrapedPost;
    irisLog('info', 'Selected post for rewriting', {
      post_id: scrapedPost.id,
      engagement_score: scrapedPost.engagement_score,
      textLength: scrapedPost.original_text.length,
    });

    // 2. Set post status to 'processing' (with error check)
    const { error: lockError } = await supabase
      .from('scraped_posts')
      .update({ status: 'processing' })
      .eq('id', scrapedPost.id)
      .eq('status', 'new'); // Optimistic lock — only update if still 'new'

    if (lockError) {
      irisLog('error', 'Failed to lock post', { post_id: scrapedPost.id, error: lockError.message });
      throw new Error(`Failed to lock post: ${lockError.message}`);
    }

    // 3. Fetch active voice samples
    const { data: samples } = await supabase
      .from('voice_samples')
      .select('*')
      .eq('status', 'active')
      .order('quality_rating', { ascending: false })
      .limit(10);

    const voiceSamples = (samples as VoiceSample[] | null) ?? [];
    const sampleTexts = voiceSamples.map((s) => s.content);
    irisLog('info', 'Loaded voice samples', { count: voiceSamples.length });

    // 4. Rewrite post via Claude API
    const { rewrittenText, imagePrompt } = await rewritePost(
      scrapedPost.original_text,
      sampleTexts
    );

    // 5. Insert generated content
    const insertData: GeneratedContentInsert = {
      scraped_post_id: scrapedPost.id,
      content_type: 'facebook_post',
      generated_text: rewrittenText,
      generated_image_url: null,
      image_prompt: imagePrompt,
      voice_style: '操盘手',
      language_mix: '70zh_30en',
      iris_model: 'claude-opus-4-6',
      revision_notes: null,
      status: 'pending_review',
      version: 1,
    };

    const { data: generated, error: insertError } = await supabase
      .from('generated_content')
      .insert(insertData)
      .select('id')
      .single();

    if (insertError || !generated) {
      throw new Error(`Failed to insert generated content: ${insertError?.message}`);
    }

    // 6. Mark scraped post as 'used'
    const { error: usedError } = await supabase
      .from('scraped_posts')
      .update({ status: 'used' })
      .eq('id', scrapedPost.id);

    if (usedError) {
      irisLog('error', 'Failed to mark post as used', { post_id: scrapedPost.id, error: usedError.message });
    }

    const result: IrisRunResult = {
      success: true,
      post_id: scrapedPost.id,
      generated_content_id: generated.id,
      engagement_score: scrapedPost.engagement_score,
      duration_ms: Date.now() - start,
      rewritten_text: rewrittenText,
      image_prompt: imagePrompt,
    };

    irisLog('info', 'IRIS run complete', {
      post_id: result.post_id,
      generated_content_id: result.generated_content_id,
      duration_ms: result.duration_ms,
    });

    return result;
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    irisLog('error', 'IRIS run failed', { error: errorMessage });
    return {
      success: false,
      post_id: null,
      generated_content_id: null,
      engagement_score: null,
      duration_ms: Date.now() - start,
      error: errorMessage,
    };
  }
}
