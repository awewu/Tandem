/**
 * MinIO 集成 · 文件存储
 *
 * MinIO 是 AGPL, V1 启用前需法务 review.
 * 生产替代: 私有部署 SeaweedFS / 公有云 S3 / OSS / OBS / COS.
 *
 * 启用步骤:
 *   1. docker-compose up minio
 *   2. npm i minio
 *   3. 配 MINIO_ENDPOINT / MINIO_ACCESS_KEY / MINIO_SECRET_KEY
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

const MINIO_ENDPOINT = process.env.MINIO_ENDPOINT ?? 'localhost:9000';
const MINIO_ACCESS_KEY = process.env.MINIO_ACCESS_KEY ?? '';
const MINIO_SECRET_KEY = process.env.MINIO_SECRET_KEY ?? '';
const MINIO_BUCKET = process.env.MINIO_BUCKET ?? 'tandem';
const MINIO_REGION = process.env.MINIO_REGION ?? 'cn-east-1';

export interface UploadParams {
  key: string;
  data: Buffer | Uint8Array;
  mimeType?: string;
  metadata?: Record<string, string>;
}

export interface UploadResult {
  key: string;
  etag: string;
  size: number;
  url: string;
}

let _client: any = null;

async function getClient(): Promise<any> {
  if (_client) return _client;
  try {
    // @ts-expect-error optional dependency
    const Minio = await import('minio');
    _client = new Minio.Client({
      endPoint: MINIO_ENDPOINT.split(':')[0],
      port: Number(MINIO_ENDPOINT.split(':')[1] ?? 9000),
      useSSL: false,
      accessKey: MINIO_ACCESS_KEY,
      secretKey: MINIO_SECRET_KEY,
      region: MINIO_REGION,
    });
    return _client;
  } catch {
    throw new Error('minio package not installed. Run: npm i minio');
  }
}

export async function ensureBucket(bucket = MINIO_BUCKET): Promise<void> {
  const client = await getClient();
  const exists = await client.bucketExists(bucket);
  if (!exists) {
    await client.makeBucket(bucket, MINIO_REGION);
  }
}

export async function upload(params: UploadParams): Promise<UploadResult> {
  if (!MINIO_ACCESS_KEY) {
    return {
      key: params.key,
      etag: 'stub',
      size: params.data.length,
      url: `stub://minio/${params.key}`,
    };
  }
  const client = await getClient();
  await ensureBucket();
  const result = await client.putObject(MINIO_BUCKET, params.key, params.data, {
    'Content-Type': params.mimeType ?? 'application/octet-stream',
    ...params.metadata,
  });
  return {
    key: params.key,
    etag: result.etag,
    size: params.data.length,
    url: await getPresignedUrl(params.key, 3600),
  };
}

export async function getPresignedUrl(key: string, expiresInSec = 3600): Promise<string> {
  if (!MINIO_ACCESS_KEY) return `stub://minio/${key}`;
  const client = await getClient();
  return client.presignedGetObject(MINIO_BUCKET, key, expiresInSec);
}

export async function deleteObject(key: string): Promise<void> {
  if (!MINIO_ACCESS_KEY) return;
  const client = await getClient();
  await client.removeObject(MINIO_BUCKET, key);
}
