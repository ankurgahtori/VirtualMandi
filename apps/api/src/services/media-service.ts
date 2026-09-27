import {
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { MediaDto } from '@virtual-mandi/shared';
import { config } from '../config.js';

const endpoint =
  process.env.S3_ENDPOINT ??
  (config.NODE_ENV === 'production' ? undefined : 'http://localhost:4566');
const bucket = process.env.S3_BUCKET ?? 'virtual-mandi-local';
const client = new S3Client({
  region: process.env.AWS_REGION ?? 'ap-south-1',
  endpoint,
  forcePathStyle: Boolean(endpoint),
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? 'test',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? 'test',
  },
});

export const checkMediaStorage = async () => {
  await client.send(new HeadBucketCommand({ Bucket: bucket }));
};

/**
 * Resolves a media object's display URL. When S3_PUBLIC_BASE_URL is configured
 * (e.g. a CDN or public bucket) it returns that absolute URL; otherwise it
 * returns the API media proxy path, which clients resolve against their own
 * configured API base URL — so mobile devices never see unreachable hosts.
 */
export const publicMediaUrl = (objectKey: string): string =>
  config.S3_PUBLIC_BASE_URL
    ? `${config.S3_PUBLIC_BASE_URL}/${objectKey}`
    : `/v1/media/${objectKey}`;

export const getMediaObject = (objectKey: string) =>
  client.send(new GetObjectCommand({ Bucket: bucket, Key: objectKey }));

export interface MediaStorage {
  createUploadUrl(input: {
    objectKey: string;
    mimeType: string;
  }): Promise<{ uploadUrl: string; objectKey: string }>;
  createDownloadUrl(input: { objectKey: string }): Promise<string>;
}

export class ConfiguredMediaStorage implements MediaStorage {
  async createUploadUrl(input: { objectKey: string; mimeType: string }) {
    const uploadUrl = await getSignedUrl(
      client,
      new PutObjectCommand({ Bucket: bucket, Key: input.objectKey, ContentType: input.mimeType }),
      { expiresIn: 900 },
    );
    return { uploadUrl, objectKey: input.objectKey };
  }

  async createDownloadUrl(input: { objectKey: string }) {
    return getSignedUrl(client, new GetObjectCommand({ Bucket: bucket, Key: input.objectKey }), {
      expiresIn: 900,
    });
  }
}

export const toMediaDto = (media: {
  id: string;
  provider: 'S3' | 'LOCALSTACK_S3';
  mimeType: string;
  objectKey: string;
  width?: number | null;
  height?: number | null;
  sizeBytes?: number | null;
}): MediaDto => ({
  id: media.id,
  provider: media.provider,
  mimeType: media.mimeType,
  objectKey: media.objectKey,
  url: publicMediaUrl(media.objectKey),
  ...(media.width == null ? {} : { width: media.width }),
  ...(media.height == null ? {} : { height: media.height }),
  ...(media.sizeBytes == null ? {} : { sizeBytes: media.sizeBytes }),
});
