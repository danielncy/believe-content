// IMAGEN — Core Gemini Image Generation Logic

import { GoogleGenAI } from '@google/genai';
import { imagenLog } from './logger';

const genai = new GoogleGenAI({ apiKey: process.env.GOOGLE_AI_API_KEY! });

const MODEL = 'imagen-4.0-generate-001';

export interface GenerateImageResult {
  imageBytes: Buffer;
  mimeType: string;
}

export async function generateImage(prompt: string): Promise<GenerateImageResult> {
  imagenLog('info', 'Calling Imagen API', { promptLength: prompt.length, model: MODEL });

  const response = await genai.models.generateImages({
    model: MODEL,
    prompt,
    config: {
      numberOfImages: 1,
      aspectRatio: '1:1',
    },
  });

  if (!response.generatedImages || response.generatedImages.length === 0) {
    throw new Error('No images generated — prompt may have been filtered by safety policy');
  }

  const generated = response.generatedImages[0];
  if (!generated.image?.imageBytes) {
    throw new Error('Image response missing imageBytes');
  }

  const imageBytes = Buffer.from(generated.image.imageBytes, 'base64');

  imagenLog('info', 'Image generated successfully', {
    sizeBytes: imageBytes.length,
  });

  return {
    imageBytes,
    mimeType: 'image/png',
  };
}
