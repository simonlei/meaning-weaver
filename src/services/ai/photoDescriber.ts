import { Result, Err } from '../../lib/result';
import { AIError, callHunyuanText, VISION_MODEL } from './client';
import { PHOTO_DESCRIPTION_SYSTEM_PROMPT, buildPhotoDescriptionContent } from './prompts';
import * as FileSystem from 'expo-file-system';
import * as ImageManipulator from 'expo-image-manipulator';

/**
 * Compress a photo and return its base64 data URI.
 * Returns null if compression or reading fails — caller skips the image.
 */
function isSafePhotoUri(uri: string): boolean {
  const docDir = FileSystem.documentDirectory ?? '';
  const cacheDir = FileSystem.cacheDirectory ?? '';
  return (
    uri.startsWith('file://') &&
    (uri.startsWith(docDir) || uri.startsWith(cacheDir))
  );
}

export async function compressAndReadBase64(photoUri: string): Promise<string | null> {
  let compressedUri: string | null = null;
  try {
    if (!isSafePhotoUri(photoUri)) {
      console.warn('Rejected unsafe photo_uri:', photoUri);
      return null;
    }
    const compressed = await ImageManipulator.manipulateAsync(
      photoUri,
      [{ resize: { width: 1280 } }],
      { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
    );
    compressedUri = compressed.uri;
    const base64 = await FileSystem.readAsStringAsync(compressedUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    return `data:image/jpeg;base64,${base64}`;
  } catch (e) {
    console.warn('compressAndReadBase64 failed:', e);
    return null;
  } finally {
    if (compressedUri) {
      await FileSystem.deleteAsync(compressedUri, { idempotent: true }).catch(() => {});
    }
  }
}

/**
 * Describe a photo using the vision model.
 * Returns a natural language description string (2-4 sentences).
 *
 * @param photoUri - Local file URI of the photo
 * @param apiKey - Hunyuan API key
 * @param additionalPrompt - Optional user-provided hint (e.g. "这是我的朋友小李")
 */
export async function describePhoto(
  photoUri: string,
  apiKey: string | null,
  additionalPrompt?: string
): Promise<Result<string, AIError>> {
  const base64DataUri = await compressAndReadBase64(photoUri);
  if (!base64DataUri) {
    return Err({ kind: 'network', message: '图片压缩失败，无法读取文件' });
  }

  const userContent = buildPhotoDescriptionContent(base64DataUri, additionalPrompt);

  return callHunyuanText(apiKey, PHOTO_DESCRIPTION_SYSTEM_PROMPT, userContent, VISION_MODEL, 512);
}
