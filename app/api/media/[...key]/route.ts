// S3 media proxy. Presigns an S3 GET URL for a character-media key and 302s
// to it. Mirrors the poppy frontend's /api/media/[...key] route so the admin
// can display the same character images/reels. Runs server-side, so it needs
// no NEXT_PUBLIC vars — just the bucket names + AWS creds already in the env.
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function bucketForKey(key: string): string {
  if (key.startsWith("images/")) return process.env.POPPY_S3_BUCKET_GENERATED ?? "";
  if (key.startsWith("reels/")) return process.env.POPPY_S3_BUCKET_REELS ?? "";
  return process.env.S3_BUCKET ?? "";
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ key: string[] }> }
) {
  const { key: segments } = await ctx.params;
  // Rejoin catch-all segments and drop any leading slash so the S3 key matches.
  const s3Key = segments.join("/").replace(/^\/+/, "");

  const bucket = bucketForKey(s3Key);
  if (!bucket) {
    return NextResponse.json({ error: "storage_not_configured" }, { status: 503 });
  }

  try {
    const s3 = new S3Client({
      // These media buckets live in eu-north-1, NOT the admin's global
      // AWS_REGION (us-east-1, used for Cost Explorer). Presigning with the
      // wrong region produces a signature the bucket rejects.
      region: process.env.POPPY_S3_REGION ?? "eu-north-1",
      ...(process.env.S3_ENDPOINT
        ? { endpoint: process.env.S3_ENDPOINT, forcePathStyle: true }
        : {}),
    });
    const command = new GetObjectCommand({ Bucket: bucket, Key: s3Key });
    const url = await getSignedUrl(s3, command, { expiresIn: 3600 });
    return NextResponse.redirect(url, { status: 302 });
  } catch (err) {
    console.error(`[media] presign failed for ${bucket}/${s3Key}:`, (err as Error)?.message ?? err);
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
}
