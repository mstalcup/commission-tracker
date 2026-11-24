import { DeleteObjectCommand, GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { HttpError } from './http';

export const s3 = new S3Client({});

export const bucket = () => {
  const b = process.env.UPLOADS_BUCKET;
  if (!b) throw new Error('Missing env var UPLOADS_BUCKET');
  return b;
};

/** Every business's files live under its own prefix. */
export const businessPrefix = (businessId: string) => `businesses/${businessId}/`;

export function assertOwnKey(businessId: string, key: string) {
  if (!key.startsWith(businessPrefix(businessId)) || key.includes('..')) throw new HttpError(403, 'Not your file');
}

export function signedGetUrl(key: string, expiresIn = 3600) {
  return getSignedUrl(s3, new GetObjectCommand({ Bucket: bucket(), Key: key }), { expiresIn });
}

export async function deleteObject(businessId: string, key: string | undefined) {
  if (!key) return;
  assertOwnKey(businessId, key);
  await s3.send(new DeleteObjectCommand({ Bucket: bucket(), Key: key }));
}
