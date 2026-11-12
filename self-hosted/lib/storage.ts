import { S3Client } from '@aws-sdk/client-s3';

// The SDK uses its default credential chain, including the EC2 instance role.
// No enterprise storage configuration or long-lived application key is needed.
export function storage() {
  const region = process.env.AWS_REGION;
  const bucket = process.env.HORSEUP_S3_BUCKET;
  if (!region || !bucket) throw new Error('Document storage is not configured');
  // Local testing only (e.g. MinIO): an S3-compatible endpoint with path-style URLs. Unset in production.
  const endpoint = process.env.HORSEUP_S3_ENDPOINT;
  return { bucket, client: new S3Client({ region, ...(endpoint ? { endpoint, forcePathStyle: true } : {}) }) };
}
