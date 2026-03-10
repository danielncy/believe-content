// IRIS — Core Claude API Rewriting Logic
// Rewrites scraped 美业 posts in Daniel's voice

import Anthropic from '@anthropic-ai/sdk';
import { irisLog } from './logger';

let _anthropic: Anthropic | null = null;
function getAnthropicClient() {
  if (!_anthropic) _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return _anthropic;
}

interface RewriteResult {
  rewrittenText: string;
  imagePrompt: string;
}

const SYSTEM_PROMPT = `You are IRIS, the AI voice agent for Daniel Ng (黄老师), a beauty industry (美业) thought leader based in Singapore serving 美业人/美业创业人/美业老板 in Singapore and Malaysia.

## Voice Rules
- Language mix: 70% Mandarin / 30% English — weave naturally, never force
- Tone: 操盘手 (strategist) — confident, direct, slightly provocative
- Structure: short punchy lines, use numbered lists (1/ 2/ 3/), open with a question or bold statement, close with a truth-bomb or call-to-action
- Context: 美业 (beauty industry) — skincare, aesthetics, salon, spa, beauty entrepreneurship
- Region: Singapore & Malaysia market references
- Never use hashtags, emojis, or generic motivational fluff
- Keep it real — Daniel speaks from experience as an operator, not a coach

## Task
You will receive an original scraped post and voice samples showing Daniel's writing style.

Rewrite the post in Daniel's voice following the rules above. The rewrite should capture the INSIGHT of the original but sound 100% like Daniel wrote it.

Also generate an image prompt for Gemini Imagen 3 that would pair well with the rewritten post. The image should be professional, beauty-industry themed, and suitable for a Facebook business post. Describe the image in English.

## Output Format
Return EXACTLY this format with no additional text:

---REWRITTEN---
[your rewritten post here]
---IMAGE_PROMPT---
[your image prompt here]
---END---`;

export async function rewritePost(
  originalText: string,
  voiceSamples: string[]
): Promise<RewriteResult> {
  const samplesBlock = voiceSamples.length > 0
    ? `\n\n## Daniel's Voice Samples (for reference)\n${voiceSamples.map((s, i) => `Sample ${i + 1}:\n${s}`).join('\n\n')}`
    : '';

  const userMessage = `## Original Post to Rewrite\n${originalText}${samplesBlock}`;

  irisLog('info', 'Calling Claude API for rewrite', {
    originalLength: originalText.length,
    sampleCount: voiceSamples.length,
  });

  const response = await getAnthropicClient().messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 2048,
    messages: [{ role: 'user', content: userMessage }],
    system: SYSTEM_PROMPT,
  });

  const textBlock = response.content.find((b) => b.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('No text response from Claude API');
  }

  const raw = textBlock.text;

  // Parse structured output
  const rewrittenMatch = raw.match(/---REWRITTEN---\s*([\s\S]*?)\s*---IMAGE_PROMPT---/);
  const imageMatch = raw.match(/---IMAGE_PROMPT---\s*([\s\S]*?)\s*---END---/);

  if (!rewrittenMatch || !imageMatch) {
    irisLog('error', 'Failed to parse Claude response', { raw });
    throw new Error('Failed to parse rewrite output — unexpected format');
  }

  const result: RewriteResult = {
    rewrittenText: rewrittenMatch[1].trim(),
    imagePrompt: imageMatch[1].trim(),
  };

  irisLog('info', 'Rewrite complete', {
    rewrittenLength: result.rewrittenText.length,
    imagePromptLength: result.imagePrompt.length,
  });

  return result;
}
