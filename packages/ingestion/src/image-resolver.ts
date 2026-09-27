import { createHash } from 'node:crypto';
import { getSeedMediaConfig, prisma, uploadObject } from '@virtual-mandi/database';
import type { ImageResolver } from './service.js';

const EXTENSION_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/svg+xml': 'svg',
  'image/avif': 'avif',
};

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

/**
 * Downloads a remote image, stores it in the configured S3 bucket under a
 * deterministic `crawled/<sourceItemId|url-hash>.<ext>` key, and upserts the
 * MediaAsset row. Returns undefined (with a warning) when the image cannot be
 * fetched so the post still ingests without an image.
 */
export const createRemoteImageResolver = (
  options: {
    fetchImpl?: typeof fetch;
    keyPrefix?: string;
  } = {},
): ImageResolver => {
  const fetchImpl = options.fetchImpl ?? fetch;
  const keyPrefix = options.keyPrefix ?? 'crawled';

  return async ({ imageUrl, sourceItemId }) => {
    if (!imageUrl) return undefined;
    try {
      const response = await fetchImpl(imageUrl);
      if (!response.ok) throw new Error(`download failed with ${response.status}`);
      const mimeType =
        response.headers.get('content-type')?.split(';')[0].trim().toLowerCase() ?? '';
      const extension = EXTENSION_BY_MIME[mimeType];
      if (!extension) throw new Error(`unsupported image type: ${mimeType || 'unknown'}`);
      const body = new Uint8Array(await response.arrayBuffer());
      if (body.length === 0) throw new Error('empty image body');
      if (body.length > MAX_IMAGE_BYTES) throw new Error('image exceeds 10MB');

      const identity =
        sourceItemId ?? createHash('sha256').update(imageUrl).digest('hex').slice(0, 24);
      const objectKey = `${keyPrefix}/${identity}.${extension}`;
      const { provider, bucket } = getSeedMediaConfig();
      await uploadObject(objectKey, body, mimeType);

      const media = await prisma.mediaAsset.upsert({
        where: { objectKey },
        update: { mimeType, sizeBytes: body.length },
        create: { provider, bucket, objectKey, mimeType, sizeBytes: body.length },
      });
      return { id: media.id };
    } catch (error) {
      console.warn(
        `Image fetch skipped for ${imageUrl}: ${error instanceof Error ? error.message : error}`,
      );
      return undefined;
    }
  };
};
