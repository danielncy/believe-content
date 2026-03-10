// SCOUT — Intelligence Gathering
// Scrapes watchlist Facebook pages for 美业 content
import { createServiceClient } from '@/lib/supabase';
import type { ScrapedPostInsert, WatchlistPage } from '@/types/database';
import { scoutLog } from './logger';
import { scrapeFacebookPage } from './scraper';

export const AGENT_NAME = 'SCOUT' as const;

export interface ScoutRunResult {
  pages_processed: number;
  posts_found: number;
  posts_inserted: number;
  errors: string[];
  duration_ms: number;
}

function randomDelay(minMs: number, maxMs: number): Promise<void> {
  const ms = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function runScout(): Promise<ScoutRunResult> {
  const startTime = Date.now();
  const supabase = createServiceClient();
  const errors: string[] = [];
  let pagesProcessed = 0;
  let totalFound = 0;
  let totalInserted = 0;

  scoutLog('info', 'Starting SCOUT run');

  // Fetch active watchlist pages
  const { data: pages, error: fetchError } = await supabase
    .from('watchlist_pages')
    .select('*')
    .eq('status', 'active');

  if (fetchError) {
    const msg = `Failed to fetch watchlist pages: ${fetchError.message}`;
    scoutLog('error', msg);
    return { pages_processed: 0, posts_found: 0, posts_inserted: 0, errors: [msg], duration_ms: Date.now() - startTime };
  }

  if (!pages || pages.length === 0) {
    scoutLog('info', 'No active watchlist pages found');
    return { pages_processed: 0, posts_found: 0, posts_inserted: 0, errors: [], duration_ms: Date.now() - startTime };
  }

  scoutLog('info', `Found ${pages.length} active watchlist pages`);

  for (const page of pages as WatchlistPage[]) {
    try {
      scoutLog('info', `Scraping page: ${page.page_name}`, { pageUrl: page.page_url });

      const rawPosts = await scrapeFacebookPage(page.page_url);
      totalFound += rawPosts.length;

      if (rawPosts.length === 0) {
        scoutLog('warn', `No posts found for ${page.page_name}`);
        pagesProcessed++;
        continue;
      }

      // Get existing source_urls for this page to deduplicate
      const { data: existingPosts } = await supabase
        .from('scraped_posts')
        .select('source_url')
        .eq('watchlist_page_id', page.id)
        .not('source_url', 'is', null);

      const existingUrls = new Set((existingPosts ?? []).map((p: { source_url: string | null }) => p.source_url));

      // Filter out duplicates and prepare inserts
      const newPosts: ScrapedPostInsert[] = rawPosts
        .filter((post) => !post.postUrl || !existingUrls.has(post.postUrl))
        .map((post) => ({
          watchlist_page_id: page.id,
          source_url: post.postUrl,
          original_text: post.text,
          original_media_urls: post.mediaUrls.length > 0 ? post.mediaUrls : null,
          post_date: post.postDate,
          engagement_score: post.engagementScore,
          language: null,
          topic_tags: null,
          status: 'new' as const,
        }));

      if (newPosts.length > 0) {
        const { error: insertError } = await supabase
          .from('scraped_posts')
          .insert(newPosts);

        if (insertError) {
          const msg = `Failed to insert posts for ${page.page_name}: ${insertError.message}`;
          scoutLog('error', msg);
          errors.push(msg);
        } else {
          totalInserted += newPosts.length;
          scoutLog('info', `Inserted ${newPosts.length} new posts for ${page.page_name}`);
        }
      } else {
        scoutLog('info', `No new posts for ${page.page_name} (all duplicates)`);
      }

      // Update last_scraped_at
      await supabase
        .from('watchlist_pages')
        .update({ last_scraped_at: new Date().toISOString() })
        .eq('id', page.id);

      pagesProcessed++;

      // Random delay between pages (3-8s)
      if (pagesProcessed < pages.length) {
        await randomDelay(3000, 8000);
      }
    } catch (err) {
      const msg = `Error scraping ${page.page_name}: ${err instanceof Error ? err.message : String(err)}`;
      scoutLog('error', msg);
      errors.push(msg);
      pagesProcessed++;
    }
  }

  const result: ScoutRunResult = {
    pages_processed: pagesProcessed,
    posts_found: totalFound,
    posts_inserted: totalInserted,
    errors,
    duration_ms: Date.now() - startTime,
  };

  scoutLog('info', 'SCOUT run complete', result as unknown as Record<string, unknown>);
  return result;
}
