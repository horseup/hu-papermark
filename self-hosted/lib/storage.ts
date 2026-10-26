import { S3Client } from '@aws-sdk/client-s3';

// The SDK uses its default credential chain, including the EC2 instance role.
// No enterprise storage configuration or long-lived application key is needed.
export function storage() {
  const region = process.env.AWS_REGION;
  const bucket = process.env.HORSEUP_S3_BUCKET;
  if (!region || !bucket) throw new Error('Document storage is not configured');
  return { bucket, client: new S3Client({ region }) };
}
