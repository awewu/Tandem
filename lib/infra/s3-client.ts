/**
 * S3 Client · AWS SDK v3 (兼容 MinIO)
 *
 * 用途: Drive 文件存储, Document 附件
 *
 * §T6: 大文件不走 PG. 上传/下载用预签名 URL (15min TTL).
 *      生产期 bucket 由 ops 预创建; 这里只做 head 校验.
 */

import {
  S3Client,
  HeadBucketCommand,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  CreateBucketCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { logger } from './logger';

type GlobalWithS3 = typeof globalThis & { __tandem_s3__?: S3Client | null };
const _g = globalThis as GlobalWithS3;

export function getS3(): S3Client | null {
  if (_g.__tandem_s3__ !== undefined) return _g.__tandem_s3__;
  const endpoint = process.env.S3_ENDPOINT;
  if (!endpoint) {
    _g.__tandem_s3__ = null;
    return null;
  }
  const client = new S3Client({
    endpoint,
    region: process.env.S3_REGION ?? 'us-east-1',
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY ?? '',
      secretAccessKey: process.env.S3_SECRET_KEY ?? '',
    },
    // MinIO / 自托管 S3 必须 path-style
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE !== 'false',
  });
  _g.__tandem_s3__ = client;
  logger.info({ endpoint }, '[s3] client initialized');
  return client;
}

export const BUCKET_DRIVE = process.env.S3_BUCKET_DRIVE ?? 'tandem-drive';
export const BUCKET_ATTACHMENTS = process.env.S3_BUCKET_ATTACHMENTS ?? 'tandem-attachments';

/** Health check: HEAD bucket. */
export async function headBucket(bucket: string = BUCKET_DRIVE): Promise<void> {
  const s3 = getS3();
  if (!s3) throw new Error('S3 not configured');
  await s3.send(new HeadBucketCommand({ Bucket: bucket }));
}

/** 启动时确保 bucket 存在 (幂等). */
export async function ensureBucket(bucket: string): Promise<void> {
  const s3 = getS3();
  if (!s3) return;
  try {
    await s3.send(new HeadBucketCommand({ Bucket: bucket }));
  } catch {
    try {
      await s3.send(new CreateBucketCommand({ Bucket: bucket }));
      logger.info({ bucket }, '[s3] bucket created');
    } catch (err) {
      logger.warn({ bucket, err: (err as Error).message }, '[s3] ensureBucket failed');
    }
  }
}

/** 预签名上传 URL (PUT). */
export async function presignUpload(
  key: string,
  opts: { bucket?: string; contentType?: string; expiresInSec?: number } = {},
): Promise<string> {
  const s3 = getS3();
  if (!s3) throw new Error('S3 not configured');
  const cmd = new PutObjectCommand({
    Bucket: opts.bucket ?? BUCKET_DRIVE,
    Key: key,
    ContentType: opts.contentType,
  });
  return getSignedUrl(s3, cmd, { expiresIn: opts.expiresInSec ?? 900 });
}

/** 预签名下载 URL (GET). */
export async function presignDownload(
  key: string,
  opts: { bucket?: string; expiresInSec?: number } = {},
): Promise<string> {
  const s3 = getS3();
  if (!s3) throw new Error('S3 not configured');
  const cmd = new GetObjectCommand({
    Bucket: opts.bucket ?? BUCKET_DRIVE,
    Key: key,
  });
  return getSignedUrl(s3, cmd, { expiresIn: opts.expiresInSec ?? 900 });
}

export async function deleteObject(key: string, bucket: string = BUCKET_DRIVE): Promise<void> {
  const s3 = getS3();
  if (!s3) throw new Error('S3 not configured');
  await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}
