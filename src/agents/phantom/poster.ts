// PHANTOM — Core Facebook Posting Logic (Playwright browser automation)
// Posts to personal Facebook profile using saved session cookies
// Supports interactive 2FA via STAGE dashboard

import { chromium, type BrowserContext } from 'playwright';
import { createServiceClient } from '@/lib/supabase';
import { phantomLog } from './logger';

export interface PostInput {
  text: string;
  imageUrl: string | null;
}

export interface PostResult {
  success: boolean;
  postId: string | null;
  publishedUrl: string | null;
  error?: string;
}

export interface LoginResult {
  loggedIn: boolean;
  requiresTwoFA: boolean;
}

export interface TwoFAChallenge {
  checkpointUrl: string;
  timestamp: string;
}

export interface TwoFASubmitResult {
  success: boolean;
  error?: string;
}

const COOKIES_KEY = 'phantom_facebook_cookies';
const CHECKPOINT_COOKIES_KEY = 'phantom_checkpoint_cookies';
const TWO_FA_CHALLENGE_KEY = 'phantom_2fa_challenge';
const BUCKET_NAME = 'generated-images';

// Chromium stealth args to avoid bot detection
const CHROMIUM_ARGS = [
  '--disable-blink-features=AutomationControlled',
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-dev-shm-usage',
];

// Save debug screenshot to Supabase Storage
async function saveDebugScreenshot(page: Awaited<ReturnType<BrowserContext['newPage']>>, label: string): Promise<void> {
  try {
    const buffer = await page.screenshot({ fullPage: false });
    const supabase = createServiceClient();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const path = `system/phantom-debug/${timestamp}_${label}.png`;
    await supabase.storage.from(BUCKET_NAME).upload(path, buffer, {
      contentType: 'image/png',
      upsert: true,
    });
    phantomLog('info', `Debug screenshot saved: ${path}`);
  } catch (err) {
    phantomLog('warn', `Failed to save debug screenshot: ${err instanceof Error ? err.message : String(err)}`);
  }
}

function randomDelay(minMs: number, maxMs: number): Promise<void> {
  const ms = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// --- Cookie persistence via Supabase Storage ---

async function loadCookies(): Promise<Array<Record<string, unknown>> | null> {
  const supabase = createServiceClient();
  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .download(`system/${COOKIES_KEY}.json`);

  if (error || !data) {
    phantomLog('warn', 'No saved cookies found', { error: error?.message });
    return null;
  }

  const text = await data.text();
  return JSON.parse(text);
}

async function saveCookies(cookies: Array<Record<string, unknown>>): Promise<void> {
  const supabase = createServiceClient();
  const blob = new Blob([JSON.stringify(cookies)], { type: 'application/json' });

  await supabase.storage
    .from(BUCKET_NAME)
    .upload(`system/${COOKIES_KEY}.json`, blob, {
      contentType: 'application/json',
      upsert: true,
    });

  phantomLog('info', 'Cookies saved to storage');
}

// --- Checkpoint cookie persistence (mid-2FA browser state) ---

async function saveCheckpointCookies(cookies: Array<Record<string, unknown>>): Promise<void> {
  const supabase = createServiceClient();
  const blob = new Blob([JSON.stringify(cookies)], { type: 'application/json' });

  await supabase.storage
    .from(BUCKET_NAME)
    .upload(`system/${CHECKPOINT_COOKIES_KEY}.json`, blob, {
      contentType: 'application/json',
      upsert: true,
    });

  phantomLog('info', 'Checkpoint cookies saved');
}

async function loadCheckpointCookies(): Promise<Array<Record<string, unknown>> | null> {
  const supabase = createServiceClient();
  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .download(`system/${CHECKPOINT_COOKIES_KEY}.json`);

  if (error || !data) return null;
  const text = await data.text();
  return JSON.parse(text);
}

async function clearCheckpointCookies(): Promise<void> {
  const supabase = createServiceClient();
  await supabase.storage.from(BUCKET_NAME).remove([`system/${CHECKPOINT_COOKIES_KEY}.json`]);
}

// --- 2FA Challenge state ---

export async function saveTwoFAChallenge(challenge: TwoFAChallenge): Promise<void> {
  const supabase = createServiceClient();
  const blob = new Blob([JSON.stringify(challenge)], { type: 'application/json' });

  await supabase.storage
    .from(BUCKET_NAME)
    .upload(`system/${TWO_FA_CHALLENGE_KEY}.json`, blob, {
      contentType: 'application/json',
      upsert: true,
    });

  phantomLog('info', '2FA challenge saved', { checkpointUrl: challenge.checkpointUrl });
}

export async function loadTwoFAChallenge(): Promise<TwoFAChallenge | null> {
  const supabase = createServiceClient();
  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .download(`system/${TWO_FA_CHALLENGE_KEY}.json`);

  if (error || !data) return null;
  const text = await data.text();
  return JSON.parse(text);
}

export async function clearTwoFAChallenge(): Promise<void> {
  const supabase = createServiceClient();
  await supabase.storage.from(BUCKET_NAME).remove([`system/${TWO_FA_CHALLENGE_KEY}.json`]);
  await clearCheckpointCookies();
  phantomLog('info', '2FA challenge cleared');
}

// --- Browser login ---

async function loginToFacebook(context: BrowserContext): Promise<LoginResult> {
  const email = process.env.FACEBOOK_EMAIL;
  const password = process.env.FACEBOOK_PASSWORD;

  if (!email || !password) {
    phantomLog('error', 'Missing FACEBOOK_EMAIL or FACEBOOK_PASSWORD');
    return { loggedIn: false, requiresTwoFA: false };
  }

  const page = await context.newPage();

  try {
    phantomLog('info', 'Logging into Facebook');
    await page.goto('https://www.facebook.com/login', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await randomDelay(1000, 2000);

    // Dismiss any cookie consent dialogs first
    const cookieBtn = page.locator('button[data-cookiebanner="accept_button"], button:has-text("Allow"), button:has-text("Accept All"), button[title="Allow all cookies"]').first();
    const hasCookieBanner = await cookieBtn.isVisible({ timeout: 3000 }).catch(() => false);
    if (hasCookieBanner) {
      phantomLog('info', 'Dismissing cookie consent banner');
      await cookieBtn.click();
      await randomDelay(1000, 2000);
    }

    // Wait for login form to appear
    const emailInput = page.locator('input[name="email"], input#email').first();
    await emailInput.waitFor({ state: 'visible', timeout: 15000 });

    await emailInput.fill(email);
    await randomDelay(300, 600);

    const passInput = page.locator('input[name="pass"], input#pass').first();
    await passInput.fill(password);
    await randomDelay(300, 600);

    // Try clicking login button, fall back to pressing Enter
    const loginBtn = page.locator('button[name="login"], button[id="loginbutton"], button[data-testid="royal_login_button"], button[type="submit"]').first();
    const btnVisible = await loginBtn.isVisible({ timeout: 3000 }).catch(() => false);

    if (btnVisible) {
      await loginBtn.click();
    } else {
      phantomLog('info', 'Login button not found, pressing Enter');
      await passInput.press('Enter');
    }

    // Wait for navigation — may land on 2FA page which loads slowly
    await page.waitForURL('**/facebook.com/**', { timeout: 30000 }).catch(() => {
      phantomLog('info', 'waitForURL timed out, checking current URL');
    });
    await randomDelay(2000, 3000);

    const url = page.url();
    phantomLog('info', 'Post-login URL', { url });

    // Check for 2FA checkpoint
    if (url.includes('/two_step_verification') || url.includes('/checkpoint') || url.includes('two_factor')) {
      phantomLog('warn', '2FA checkpoint detected', { url });

      // Save checkpoint cookies so we can resume after 2FA code entry
      const checkpointCookies = await context.cookies();
      await saveCheckpointCookies(checkpointCookies as unknown as Array<Record<string, unknown>>);

      // Save challenge details
      await saveTwoFAChallenge({
        checkpointUrl: url,
        timestamp: new Date().toISOString(),
      });

      return { loggedIn: false, requiresTwoFA: true };
    }

    // Check if login failed for other reasons
    if (url.includes('/login')) {
      phantomLog('error', 'Login failed — invalid credentials', { url });
      return { loggedIn: false, requiresTwoFA: false };
    }

    // Success — save session cookies
    const cookies = await context.cookies();
    await saveCookies(cookies as unknown as Array<Record<string, unknown>>);

    phantomLog('info', 'Login successful');
    return { loggedIn: true, requiresTwoFA: false };
  } finally {
    await page.close();
  }
}

// --- Submit 2FA code (called from API route) ---

export async function submitTwoFACode(code: string): Promise<TwoFASubmitResult> {
  phantomLog('info', 'Submitting 2FA code');

  const challenge = await loadTwoFAChallenge();
  if (!challenge) {
    return { success: false, error: 'No active 2FA challenge found' };
  }

  const checkpointCookies = await loadCheckpointCookies();
  if (!checkpointCookies) {
    return { success: false, error: 'No checkpoint cookies found — need fresh login' };
  }

  let browser;

  try {
    browser = await chromium.launch({ headless: true, args: CHROMIUM_ARGS });
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1280, height: 720 },
      locale: 'en-US',
    });

    // Restore checkpoint cookies
    await context.addCookies(checkpointCookies as unknown as Parameters<typeof context.addCookies>[0]);

    const page = await context.newPage();
    await page.goto(challenge.checkpointUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await randomDelay(1000, 2000);

    // Try to find and fill the 2FA code input
    // Facebook uses various selectors for 2FA input
    const codeInput = page.locator(
      'input[name="approvals_code"], input[id="approvals_code"], input[type="text"], input[type="tel"], input[inputmode="numeric"]'
    ).first();

    const inputVisible = await codeInput.isVisible({ timeout: 5000 }).catch(() => false);

    if (!inputVisible) {
      phantomLog('error', '2FA code input not found on page', { url: page.url() });
      await browser.close();
      return { success: false, error: '2FA code input not found — challenge may have expired' };
    }

    await codeInput.fill(code);
    await randomDelay(500, 800);

    // Click Continue/Submit button, fall back to Enter key
    const submitBtn = page.locator(
      'button[type="submit"], button:has-text("Continue"), button:has-text("Submit"), button[id="checkpointSubmitButton"], [role="button"]:has-text("Continue")'
    ).first();
    const submitVisible = await submitBtn.isVisible({ timeout: 3000 }).catch(() => false);

    if (submitVisible) {
      await submitBtn.click();
    } else {
      phantomLog('info', '2FA submit button not found, pressing Enter');
      await codeInput.press('Enter');
    }

    // Wait for navigation
    await page.waitForURL('**/facebook.com/**', { timeout: 30000 }).catch(() => {});
    await randomDelay(2000, 3000);

    const resultUrl = page.url();

    // Check if we're still on checkpoint (wrong code)
    if (resultUrl.includes('/two_step_verification') || resultUrl.includes('/checkpoint')) {
      phantomLog('error', '2FA code rejected — still on checkpoint', { url: resultUrl });

      // Check for "Don't save browser" type prompts — might need another click
      const dontSaveBtn = page.locator(
        'button:has-text("Don\'t Save"), button:has-text("Continue"), a:has-text("Continue")'
      ).first();
      const hasDontSave = await dontSaveBtn.isVisible({ timeout: 3000 }).catch(() => false);

      if (hasDontSave) {
        phantomLog('info', 'Found post-2FA continue prompt, clicking');
        await dontSaveBtn.click();
        await page.waitForURL('**/facebook.com/**', { timeout: 15000 }).catch(() => {});
        await randomDelay(2000, 3000);

        const finalUrl = page.url();
        if (!finalUrl.includes('/checkpoint') && !finalUrl.includes('/two_step_verification')) {
          // Success after extra step
          const freshCookies = await context.cookies();
          await saveCookies(freshCookies as unknown as Array<Record<string, unknown>>);
          await clearTwoFAChallenge();
          await browser.close();
          phantomLog('info', '2FA verification successful (after continue prompt)');
          return { success: true };
        }
      }

      await browser.close();
      return { success: false, error: 'Invalid 2FA code — please try again' };
    }

    // Success — save fresh session cookies
    const freshCookies = await context.cookies();
    await saveCookies(freshCookies as unknown as Array<Record<string, unknown>>);
    await clearTwoFAChallenge();

    await browser.close();
    phantomLog('info', '2FA verification successful');
    return { success: true };
  } catch (err) {
    if (browser) await browser.close();
    const errorMsg = err instanceof Error ? err.message : String(err);
    phantomLog('error', '2FA submission failed', { error: errorMsg });
    return { success: false, error: errorMsg };
  }
}

// --- Image download helper ---

async function downloadImage(imageUrl: string): Promise<Buffer> {
  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error(`Failed to download image: HTTP ${response.status}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

// --- Main posting function ---

export async function postToFacebook(input: PostInput): Promise<PostResult> {
  phantomLog('info', 'Posting to Facebook via Playwright', {
    hasImage: !!input.imageUrl,
    textLength: input.text.length,
  });

  let browser;

  try {
    browser = await chromium.launch({ headless: true, args: CHROMIUM_ARGS });
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1280, height: 720 },
      locale: 'en-US',
    });

    // 1. Try loading saved cookies
    const cookies = await loadCookies();
    if (cookies) {
      phantomLog('info', 'Restoring saved cookies');
      await context.addCookies(cookies as unknown as Parameters<typeof context.addCookies>[0]);
    }

    // 2. Navigate to own profile page (more reliable for posting than feed)
    const page = await context.newPage();
    await page.goto('https://www.facebook.com/me', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await randomDelay(3000, 5000);

    const isLoggedIn = await page.locator('[aria-label="Create a post"], [aria-label="创建帖子"], span:has-text("on your mind")').first().isVisible({ timeout: 10000 }).catch(() => false);

    if (!isLoggedIn) {
      phantomLog('info', 'Not logged in, attempting fresh login');
      await page.close();

      const loginResult = await loginToFacebook(context);

      if (loginResult.requiresTwoFA) {
        await browser.close();
        return {
          success: false,
          postId: null,
          publishedUrl: null,
          error: '2FA_REQUIRED',
        };
      }

      if (!loginResult.loggedIn) {
        await browser.close();
        return {
          success: false,
          postId: null,
          publishedUrl: null,
          error: 'Facebook login failed — check credentials',
        };
      }

      // Re-navigate after login — go to profile page
      const newPage = await context.newPage();
      await newPage.goto('https://www.facebook.com/me', { waitUntil: 'domcontentloaded', timeout: 30000 });
      await randomDelay(2000, 3000);
      await postContent(newPage, input);
      const newCookies = await context.cookies();
      await saveCookies(newCookies as unknown as Array<Record<string, unknown>>);
      await newPage.close();
    } else {
      // Already logged in, post directly
      await postContent(page, input);
      const freshCookies = await context.cookies();
      await saveCookies(freshCookies as unknown as Array<Record<string, unknown>>);
      await page.close();
    }

    await browser.close();

    return {
      success: true,
      postId: null,
      publishedUrl: 'https://www.facebook.com/me',
    };
  } catch (err) {
    if (browser) await browser.close();
    const errorMsg = err instanceof Error ? err.message : String(err);
    phantomLog('error', 'Post failed', { error: errorMsg });
    return {
      success: false,
      postId: null,
      publishedUrl: null,
      error: errorMsg,
    };
  }
}

// --- Post content to Facebook ---

async function postContent(page: Awaited<ReturnType<BrowserContext['newPage']>>, input: PostInput): Promise<void> {
  // Click "What's on your mind?" to open post composer
  phantomLog('info', 'Opening post composer');
  phantomLog('info', 'Current URL', { url: page.url() });

  await saveDebugScreenshot(page, '01-before-composer');

  const createPostSelectors = [
    '[aria-label="Create a post"]',
    '[aria-label="创建帖子"]',
    'span:has-text("on your mind")',
    'div[role="button"]:has-text("on your mind")',
    '[aria-placeholder*="on your mind"]',
  ];

  let composerOpened = false;
  for (const sel of createPostSelectors) {
    const btn = page.locator(sel).first();
    const visible = await btn.isVisible({ timeout: 3000 }).catch(() => false);
    if (visible) {
      phantomLog('info', `Create post button found: ${sel}`);
      await btn.click();
      composerOpened = true;
      break;
    }
  }

  if (!composerOpened) {
    await saveDebugScreenshot(page, '01-composer-not-found');
    throw new Error('Create Post button not found — page may not be logged in or layout changed');
  }

  await randomDelay(2000, 3000);

  // Wait for the post composer dialog (must contain a textbox, not just any dialog)
  phantomLog('info', 'Waiting for composer dialog with textbox');
  const postDialog = page.locator('[role="dialog"]:has([role="textbox"][contenteditable="true"])').first();
  await postDialog.waitFor({ state: 'visible', timeout: 15000 });

  await saveDebugScreenshot(page, '02-dialog-open');

  // Type the post text
  phantomLog('info', 'Typing post text');
  const textArea = postDialog.locator('[role="textbox"][contenteditable="true"]').first();
  await textArea.click();
  await randomDelay(500, 800);

  // Use keyboard typing instead of fill() for more natural behavior
  await textArea.fill(input.text);
  await randomDelay(1000, 2000);

  await saveDebugScreenshot(page, '03-text-typed');

  // Upload image if available
  if (input.imageUrl) {
    phantomLog('info', 'Uploading image');

    const photoBtn = postDialog.locator('[aria-label="Photo/video"], [aria-label="照片/视频"]').first();
    const photoBtnVisible = await photoBtn.isVisible({ timeout: 3000 }).catch(() => false);

    if (photoBtnVisible) {
      await photoBtn.click();
      await randomDelay(1000, 2000);
    }

    const imageBuffer = await downloadImage(input.imageUrl);
    const fileInput = postDialog.locator('input[type="file"][accept*="image"]').first();
    await fileInput.setInputFiles({
      name: 'post-image.png',
      mimeType: 'image/png',
      buffer: imageBuffer,
    });
    await randomDelay(3000, 5000);
    phantomLog('info', 'Image uploaded');
    await saveDebugScreenshot(page, '04-image-uploaded');
  }

  // Submit the post — Facebook has a two-step flow: "Next" → then "Post"
  phantomLog('info', 'Looking for submit button (Next or Post)');

  // Step 1: Click "Next" or "Post" — whichever appears first
  const submitSelectors = [
    // Direct "Post" button (older UI)
    '[aria-label="Post"]',
    '[aria-label="发布"]',
    // "Next" button (newer two-step UI)
    'div[role="button"]:has-text("Next")',
    'div[role="button"]:has-text("下一步")',
    // Generic post/publish
    'div[role="button"]:has-text("Post")',
    'div[role="button"]:has-text("发布")',
    'div[role="button"]:has-text("Publish")',
  ];

  let firstStepClicked = false;
  let clickedSelector = '';
  for (const sel of submitSelectors) {
    const btn = postDialog.locator(sel).first();
    const visible = await btn.isVisible({ timeout: 2000 }).catch(() => false);
    if (visible) {
      phantomLog('info', `Submit button found: ${sel}`);
      await btn.click();
      firstStepClicked = true;
      clickedSelector = sel;
      break;
    }
  }

  if (!firstStepClicked) {
    // Log available buttons for debugging
    const allButtons = await postDialog.locator('div[role="button"], button').all();
    const buttonLabels: string[] = [];
    for (const btn of allButtons.slice(0, 15)) {
      const label = await btn.getAttribute('aria-label').catch(() => null);
      const text = await btn.innerText().catch(() => '');
      buttonLabels.push(`[aria-label="${label}"] text="${text.slice(0, 30)}"`);
    }
    phantomLog('error', 'No submit button found', { buttons: buttonLabels });
    await saveDebugScreenshot(page, '05-post-btn-not-found');
    throw new Error('Post/Next button not found in compose dialog');
  }

  await randomDelay(2000, 3000);

  // Step 2: If we clicked "Next", there should be a second "Post" button
  if (clickedSelector.includes('Next') || clickedSelector.includes('下一步')) {
    phantomLog('info', 'Clicked Next — looking for final Post button');
    await saveDebugScreenshot(page, '05-after-next');

    // The Post button may appear in a new dialog or the same one
    const finalPostSelectors = [
      '[aria-label="Post"]',
      '[aria-label="发布"]',
      'div[role="button"]:has-text("Post")',
      'div[role="button"]:has-text("发布")',
      'div[role="button"]:has-text("Publish")',
    ];

    let finalClicked = false;
    for (const sel of finalPostSelectors) {
      const btn = page.locator(sel).first();
      const visible = await btn.isVisible({ timeout: 5000 }).catch(() => false);
      if (visible) {
        phantomLog('info', `Final Post button found: ${sel}`);
        await btn.click();
        finalClicked = true;
        break;
      }
    }

    if (!finalClicked) {
      await saveDebugScreenshot(page, '05-final-post-not-found');
      throw new Error('Final Post button not found after clicking Next');
    }
  }

  // Wait for dialog to close (indicates post was submitted)
  phantomLog('info', 'Waiting for post dialog to close');
  try {
    await postDialog.waitFor({ state: 'hidden', timeout: 30000 });
    phantomLog('info', 'Post dialog closed — post submitted successfully');
  } catch {
    // Dialog didn't close — post likely failed
    await saveDebugScreenshot(page, '06-dialog-still-open');
    throw new Error('Post dialog did not close after clicking Post — submission may have failed');
  }

  await randomDelay(2000, 3000);
  await saveDebugScreenshot(page, '07-post-complete');
}
