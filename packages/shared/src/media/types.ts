export type MediaProvider = 'S3' | 'LOCALSTACK_S3';

export type MediaDto = {
  id: string;
  provider: MediaProvider;
  mimeType: string;
  objectKey: string;
  url: string;
  width?: number;
  height?: number;
  sizeBytes?: number;
};
