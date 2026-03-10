// IMAGEN — Image Generation Agent
// Picks generated_content rows with image_prompt but no image → generates via Imagen → uploads to Storage

import { createServiceClient } from '@/lib/supabase';
import { imagenLog } from './logger';
import { generateImage } from './generator';
import { ensureBucket, uploadImage } from './uploader';
import type { GeneratedContent } from '@/types/database';

export const AGENT_NAME = 'IMAGEN' as const;

export interface ImagenRunResult {
  images_processed: number;
  images_generated: number;
  images_failed: number;
  errors: string[];
  duration_ms: number;
}

export async function runImagen(limit: number = 5): Promise<ImagenRunResult> {
  const startTime = Date.now();
  const supabase = createServiceClient();
  const errors: string[] = [];
  let processed = 0;
  let generated = 0;

  imagenLog('info', 'Starting IMAGEN run', { limit });

  try {
    // 0. Ensure storage bucket exists
    await ensureBucket();

    // 1. Fetch generated_content rows needing images
    const { data: rows, error: fetchError } = await supabase
      .from('generated_content')
      .select('*')
      .eq('status', 'pending_review')
      .eq('content_type', 'facebook_post')
      .not('image_prompt', 'is', null)
      .is('generated_image_url', null)
      .order('created_at', { ascending: true })
      .limit(limit);

    if (fetchError) {
      const msg = `Failed to fetch content rows: ${fetchError.message}`;
      imagenLog('error', msg);
      return { images_processed: 0, images_generated: 0, images_failed: 0, errors: [msg], duration_ms: Date.now() - startTime };
    }

    if (!rows || rows.length === 0) {
      imagenLog('info', 'No content rows pending image generation');
      return { images_processed: 0, images_generated: 0, images_failed: 0, errors: [], duration_ms: Date.now() - startTime };
    }

    imagenLog('info', `Found ${rows.length} rows pending image generation`);

    // 2. Process each row
    for (const row of rows as GeneratedContent[]) {
      processed++;
      try {
        imagenLog('info', `Generating image for content ${row.id}`, {
          promptPreview: row.image_prompt!.substring(0, 80),
        });

        // Generate image via Imagen API
        const { imageBytes, mimeType } = await generateImage(row.image_prompt!);

        // Upload to Supabase Storage
        const publicUrl = await uploadImage(imageBytes, row.id, mimeType);

        // Update generated_content row with the image URL
        const { error: updateError } = await supabase
          .from('generated_content')
          .update({ generated_image_url: publicUrl })
          .eq('id', row.id);

        if (updateError) {
          throw new Error(`Failed to update row: ${updateError.message}`);
        }

        generated++;
        imagenLog('info', `Image generated and uploaded for content ${row.id}`);

        // Brief delay between API calls to respect rate limits
        if (processed < rows.length) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      } catch (err) {
        const msg = `Failed to generate image for ${row.id}: ${err instanceof Error ? err.message : String(err)}`;
        imagenLog('error', msg);
        errors.push(msg);
      }
    }
  } catch (err) {
    const msg = `IMAGEN run failed: ${err instanceof Error ? err.message : String(err)}`;
    imagenLog('error', msg);
    errors.push(msg);
  }

  const result: ImagenRunResult = {
    images_processed: processed,
    images_generated: generated,
    images_failed: processed - generated,
    errors,
    duration_ms: Date.now() - startTime,
  };

  imagenLog('info', 'IMAGEN run complete', result as unknown as Record<string, unknown>);
  return result;
}
