import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3";

export const dynamic = "force-dynamic";

function bucketForKey(key: string): string {
  if (key.startsWith("images/")) return process.env.POPPY_S3_BUCKET_GENERATED ?? "";
  if (key.startsWith("reels/")) return process.env.POPPY_S3_BUCKET_REELS ?? "";
  return process.env.S3_BUCKET ?? "";
}

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string; mediaId: string }> }
) {
  const { id: characterId, mediaId } = await ctx.params;

  const media = await prisma.characterMedia.findUnique({ where: { id: mediaId } });
  if (!media) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (media.characterId !== characterId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Normalise the stored url to a bare S3 key (no leading slash)
  const s3Key = media.url.replace(/^\/+/, "");
  const bucket = bucketForKey(s3Key);

  // Delete from S3 first; if it fails we still remove the DB record so the
  // admin isn't stuck with a dangling reference. Log the S3 failure.
  if (bucket && s3Key) {
    try {
      const s3 = new S3Client({
        region: process.env.POPPY_S3_REGION ?? "eu-north-1",
        ...(process.env.S3_ENDPOINT
          ? { endpoint: process.env.S3_ENDPOINT, forcePathStyle: true }
          : {}),
      });
      await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: s3Key }));
    } catch (err) {
      console.error(`[media-delete] S3 delete failed for ${bucket}/${s3Key}:`, (err as Error)?.message ?? err);
    }
  }

  await prisma.characterMedia.delete({ where: { id: mediaId } });
  return NextResponse.json({ success: true });
}
