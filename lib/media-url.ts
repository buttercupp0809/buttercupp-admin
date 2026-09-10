import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// Converts a stored CharacterMedia.url (or MediaAsset s3Key) into a URL the
// admin can actually load. Stored values are S3 keys / site-relative paths
// (e.g. "/characters/images/personas/<id>/p3.webp", "/reels/1.mp4") that only
// resolve on the poppy app's CDN. We route them through the admin's own
// /api/media proxy, which presigns an S3 GET and redirects.
export function mediaUrl(stored: string | null | undefined): string {
  if (!stored) return "";
  // Already an absolute URL (already signed/CDN): use as-is.
  if (/^https?:\/\//i.test(stored)) return stored;
  const key = stored.replace(/^\/+/, "");
  return `/api/media/${key}`;
}

// Heuristic: does this media URL point at an image (vs a video/reel)?
export function isImageUrl(stored: string | null | undefined): boolean {
  if (!stored) return false;
  return /\.(webp|png|jpe?g|gif|avif)(\?|$)/i.test(stored);
}

// ---------------------------------------------------------------------------
// Email image resolution
//
// For outbound emails the /api/media proxy is not reachable by the recipient's
// email client. We generate a presigned S3 URL (7-day expiry) or use the
// CloudFront CDN URL instead.
// ---------------------------------------------------------------------------

let _s3Client: S3Client | null = null;
function getS3Client(): S3Client {
  if (!_s3Client) {
    _s3Client = new S3Client({ region: process.env.POPPY_S3_REGION ?? "eu-north-1" });
  }
  return _s3Client;
}

function bucketForKey(key: string): string {
  if (key.startsWith("images/")) return process.env.POPPY_S3_BUCKET_GENERATED ?? "";
  if (key.startsWith("reels/")) return process.env.POPPY_S3_BUCKET_REELS ?? "";
  return process.env.S3_BUCKET ?? "";
}

/** Presign an S3 GET for a stored key (7-day expiry, the SigV4 maximum). */
async function presignKey(key: string): Promise<string> {
  const bucket = bucketForKey(key);
  if (!bucket) return "";
  try {
    const cmd = new GetObjectCommand({ Bucket: bucket, Key: key });
    return await getSignedUrl(getS3Client(), cmd, { expiresIn: 7 * 24 * 3600 });
  } catch {
    return "";
  }
}

/**
 * Resolve a stored CharacterMedia URL into a publicly fetchable URL for use in
 * email <img> tags. We presign S3 directly rather than use the CloudFront CDN:
 * the distribution requires signed URLs, so an unsigned CDN link 403s in an
 * email client. Presigned S3 URLs are good for 7 days. Returns an empty string
 * on failure (email renders without an image).
 */
export async function resolveImageUrl(
  raw: string | null | undefined
): Promise<string> {
  if (!raw) return "";

  if (raw.startsWith("http://") || raw.startsWith("https://")) {
    // An S3/CloudFront URL: extract the key and presign it (unsigned links 403).
    // Any other absolute URL (already public/signed) is used as-is.
    if (/amazonaws\.com|cloudfront\.net/i.test(raw)) {
      const key = decodeURIComponent(
        raw.replace(/^https?:\/\/[^/]+\//, "").split("?")[0]
      );
      return presignKey(key);
    }
    return raw;
  }

  // Stored key / path.
  return presignKey(raw.replace(/^\/+/, ""));
}
