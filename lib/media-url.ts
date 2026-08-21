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
