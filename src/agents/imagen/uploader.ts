// IMAGEN — Supabase Storage Upload Logic

import { createServiceClient } from '@/lib/supabase';
import { imagenLog } from './logger';

const BUCKET_NAME = 'generated-images';

export async function ensureBucket(): Promise<void> {
  const supabase = createServiceClient();

  const { data: buckets } = await supabase.storage.listBuckets();
  const exists = buckets?.some((b) => b.name === BUCKET_NAME);

  if (!exists) {
    imagenLog('info', 'Creating storage bucket', { bucket: BUCKET_NAME });
    const { error } = await supabase.storage.createBucket(BUCKET_NAME, {
      public: true,
      fileSizeLimit: 5 * 1024 * 1024, // 5MB
    });
    if (error && !error.message.includes('already exists')) {
      throw new Error(`Failed to create bucket: ${error.message}`);
    }
  }
}

export async function uploadImage(
  imageBytes: Buffer,
  contentId: string,
  mimeType: string = 'image/png'
): Promise<string> {
  const supabase = createServiceClient();
  const extension = mimeType === 'image/jpeg' ? 'jpg' : 'png';
  const filePath = `facebook/${contentId}.${extension}`;

  imagenLog('info', 'Uploading image to Supabase Storage', {
    bucket: BUCKET_NAME,
    filePath,
    sizeBytes: imageBytes.length,
  });

  const { error: uploadError } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(filePath, imageBytes, {
      contentType: mimeType,
      upsert: true,
    });

  if (uploadError) {
    throw new Error(`Storage upload failed: ${uploadError.message}`);
  }

  const { data: urlData } = supabase.storage
    .from(BUCKET_NAME)
    .getPublicUrl(filePath);

  if (!urlData?.publicUrl) {
    throw new Error('Failed to get public URL for uploaded image');
  }

  imagenLog('info', 'Image uploaded successfully', { publicUrl: urlData.publicUrl });
  return urlData.publicUrl;
}
