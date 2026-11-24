import { createPresignedPost } from '@aws-sdk/s3-presigned-post';
import { ulid } from 'ulid';
import { UploadRequestSchema } from '@ct/shared';
import { HttpError, parse, routes } from '../lib/http';
import { assertOwnKey, bucket, businessPrefix, s3, signedGetUrl } from '../lib/s3';

/*
 * Files never pass through our API. The browser asks for a short-lived signed
 * form, uploads straight to the private S3 bucket, then saves the returned key
 * on the commission or expense. Viewing a file gets a short-lived signed URL.
 */

export const handler = routes({
  'POST /api/uploads': async (ctx) => {
    const input = parse(UploadRequestSchema, ctx.body());
    const safeName = input.fileName.replace(/[^\w.\-]+/g, '_').slice(-80);
    const key = `${businessPrefix(ctx.business.businessId)}${input.purpose}/${ulid()}-${safeName}`;
    const { url, fields } = await createPresignedPost(s3, {
      Bucket: bucket(),
      Key: key,
      Conditions: [
        ['content-length-range', 1, 15 * 1024 * 1024],
        ['eq', '$Content-Type', input.contentType],
      ],
      Fields: { 'Content-Type': input.contentType },
      Expires: 300,
    });
    return { key, url, fields };
  },

  'GET /api/uploads/url': async ({ business, query }) => {
    if (!query.key) throw new HttpError(400, 'key is required');
    assertOwnKey(business.businessId, query.key);
    return { url: await signedGetUrl(query.key) };
  },
});
