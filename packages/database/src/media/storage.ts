import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

const endpoint =
  process.env.S3_ENDPOINT ??
  (process.env.NODE_ENV === 'production' ? undefined : 'http://localhost:4566');
const bucket = process.env.S3_BUCKET ?? 'virtual-mandi-local';
const region = process.env.AWS_REGION ?? 'ap-south-1';

export const s3Client = new S3Client({
  region,
  endpoint: endpoint || undefined,
  forcePathStyle: Boolean(endpoint),
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? 'test',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? 'test',
  },
});

export const uploadSeedImage = async (objectKey: string, body: Uint8Array): Promise<void> => {
  await s3Client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: objectKey,
      Body: body,
      ContentType: 'image/svg+xml',
    }),
  );
};

export const getSeedMediaConfig = () => ({
  provider: endpoint ? ('LOCALSTACK_S3' as const) : ('S3' as const),
  bucket,
  region,
  endpoint,
});
