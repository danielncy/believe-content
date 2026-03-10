// SCOUT — Core Facebook Scraping Logic
import { chromium, type Page } from 'playwright';
import { scoutLog } from './logger';

export interface RawPost {
  text: string;
  mediaUrls: string[];
  postDate: string | null;
  postUrl: string | null;
  likes: number;
  comments: number;
  shares: number;
  engagementScore: number;
}

function randomDelay(minMs: number, maxMs: number): Promise<void> {
  const ms = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseEngagementCount(text: string | null): number {
  if (!text) return 0;
  const cleaned = text.replace(/,/g, '').trim().toLowerCase();
  const match = cleaned.match(/([\d.]+)\s*(k|m)?/);
  if (!match) return 0;
  const num = parseFloat(match[1]);
  if (match[2] === 'k') return Math.round(num * 1000);
  if (match[2] === 'm') return Math.round(num * 1000000);
  return Math.round(num);
}

async function expandSeeMore(page: Page): Promise<void> {
  try {
    const seeMoreButtons = page.locator('[role="button"]:has-text("See more"), [role="button"]:has-text("查看更多")');
    const count = await seeMoreButtons.count();
    for (let i = 0; i < count; i++) {
      try {
        await seeMoreButtons.nth(i).click({ timeout: 2000 });
        await randomDelay(300, 600);
      } catch {
        // Button may have become stale
      }
    }
  } catch {
    // No "See more" buttons found
  }
}

export async function scrapeFacebookPage(pageUrl: string): Promise<RawPost[]> {
  const posts: RawPost[] = [];
  let browser;

  try {
    scoutLog('info', 'Launching browser', { pageUrl });
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1280, height: 720 },
      locale: 'en-US',
    });

    const page = await context.newPage();
    await page.goto(pageUrl, { waitUntil: 'networkidle', timeout: 30000 });
    scoutLog('info', 'Page loaded', { pageUrl });

    // Scroll to load posts (3-4 scrolls to get ~10 posts)
    for (let i = 0; i < 4; i++) {
      await page.evaluate(() => window.scrollBy(0, window.innerHeight * 2));
      await randomDelay(1000, 3000);
    }

    // Expand "See more" on truncated posts
    await expandSeeMore(page);

    // Extract only top-level posts (skip nested comment articles)
    const postElements = await page.locator('[role="article"]').all();
    const topLevelPosts = [];
    for (const el of postElements) {
      const parent = el.locator('xpath=ancestor::*[@role="article"]');
      if ((await parent.count()) === 0) {
        topLevelPosts.push(el);
      }
    }
    scoutLog('info', `Found ${postElements.length} article elements, ${topLevelPosts.length} top-level posts`, { pageUrl });

    const targetCount = Math.min(topLevelPosts.length, 10);

    for (let i = 0; i < targetCount; i++) {
      try {
        const el = topLevelPosts[i];

        // Extract text content
        const textParts = await el.locator('[data-ad-preview="message"], [data-ad-comet-preview="message"]').allTextContents();
        let text = textParts.join('\n').trim();

        // Fallback: grab visible text from post body area
        if (!text) {
          const allText = await el.locator('div[dir="auto"]').allTextContents();
          text = allText
            .filter((t) => t.length > 20)
            .slice(0, 3)
            .join('\n')
            .trim();
        }

        // Skip posts without meaningful text
        if (!text || text.length < 10) continue;

        // Extract media URLs
        const images = await el.locator('img[src*="fbcdn"]').all();
        const mediaUrls: string[] = [];
        for (const img of images) {
          const src = await img.getAttribute('src');
          if (src && !src.includes('emoji') && !src.includes('profile')) {
            mediaUrls.push(src);
          }
        }

        // Extract post URL
        let postUrl: string | null = null;
        const timeLink = el.locator('a[href*="/posts/"], a[href*="/photos/"], a[href*="story_fbid"]').first();
        if (await timeLink.count()) {
          postUrl = await timeLink.getAttribute('href');
          if (postUrl && !postUrl.startsWith('http')) {
            postUrl = `https://www.facebook.com${postUrl}`;
          }
        }

        // Extract post date from aria-label or datetime
        let postDate: string | null = null;
        const timeEl = el.locator('abbr[data-utime], span[id] time, a[role="link"] span[aria-label]').first();
        if (await timeEl.count()) {
          postDate = (await timeEl.getAttribute('title')) || (await timeEl.getAttribute('aria-label')) || null;
        }

        // Extract engagement counts
        const ariaLabels = await el.locator('[aria-label]').all();
        let likes = 0, comments = 0, shares = 0;

        for (const label of ariaLabels) {
          const ariaLabel = await label.getAttribute('aria-label');
          if (!ariaLabel) continue;
          const lower = ariaLabel.toLowerCase();

          if (lower.includes('like') || lower.includes('reaction')) {
            likes = Math.max(likes, parseEngagementCount(ariaLabel));
          } else if (lower.includes('comment')) {
            comments = Math.max(comments, parseEngagementCount(ariaLabel));
          } else if (lower.includes('share')) {
            shares = Math.max(shares, parseEngagementCount(ariaLabel));
          }
        }

        const engagementScore = likes * 1 + comments * 3 + shares * 5;

        // Skip comments/replies: URL contains comment_id, or zero engagement
        if (postUrl && postUrl.includes('comment_id')) {
          scoutLog('info', `Skipping comment (comment_id in URL)`, { postUrl });
          continue;
        }
        if (engagementScore === 0 && !mediaUrls.length) {
          scoutLog('info', `Skipping low-signal item (zero engagement, no media)`);
          continue;
        }

        posts.push({
          text,
          mediaUrls,
          postDate,
          postUrl,
          likes,
          comments,
          shares,
          engagementScore,
        });

        scoutLog('info', `Extracted post ${i + 1}`, {
          textLength: text.length,
          mediaCount: mediaUrls.length,
          engagementScore,
        });
      } catch (err) {
        scoutLog('warn', `Failed to extract post ${i + 1}`, {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    await browser.close();
    scoutLog('info', `Scraping complete`, { pageUrl, postsExtracted: posts.length });
  } catch (err) {
    scoutLog('error', 'Scraping failed', {
      pageUrl,
      error: err instanceof Error ? err.message : String(err),
    });
    if (browser) await browser.close();
  }

  return posts;
}
