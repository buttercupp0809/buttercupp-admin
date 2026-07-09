import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

// Mirrors Pellow's lib/paywall/types.ts PaywallContent shape (frontend/lib/paywall/types.ts).
// The admin form always fills every field, but the column is a Partial<PaywallContent> —
// Pellow's mergeContent() fills in CONTROL_CONTENT defaults for anything left out.
interface CardContentBody {
  badgeText?: string | null;
  anchorPrice?: string | null;
  recommended?: boolean;
}

interface ContentBody {
  eyebrow?: string;
  headline?: string;
  subheadline?: string;
  showChecklistAnimation?: boolean;
  showPersonalReflection?: boolean;
  cards?: {
    showMonthly?: boolean;
    showAnnual?: boolean;
    defaultSelected?: "monthly" | "annual";
    monthly?: CardContentBody;
    annual?: CardContentBody;
  };
  cta?: { label?: string };
  trustBadges?: string[];
}

interface VariantBody {
  key?: string;
  name?: string;
  status?: string;
  priceSetKey?: string | null;
  content?: ContentBody;
}

interface ParsedVariant {
  key: string;
  name: string;
  status: string;
  priceSetKey: string | null;
  content: Record<string, unknown>;
}

const STATUSES = ["draft", "active", "archived"];

export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get("key");

  if (key) {
    const variant = await prisma.paywallVariant.findUnique({ where: { key } });
    if (!variant) {
      return NextResponse.json({ error: "Variant not found" }, { status: 404 });
    }
    return NextResponse.json({ variant });
  }

  const variants = await prisma.paywallVariant.findMany({
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json({ variants });
}

function parseCard(card: CardContentBody | undefined): Record<string, unknown> {
  return {
    badgeText: card?.badgeText?.trim() || null,
    anchorPrice: card?.anchorPrice?.trim() || null,
    recommended: card?.recommended === true,
  };
}

function parseBody(body: VariantBody | null): ParsedVariant | { error: string } {
  if (!body) return { error: "Invalid JSON" };

  const key = (body.key || "").trim();
  const name = (body.name || "").trim();
  if (!key) return { error: "key is required" };
  if (!/^[a-z0-9_-]+$/i.test(key)) {
    return { error: "key must be alphanumeric (dashes/underscores allowed)" };
  }
  if (!name) return { error: "name is required" };

  const status = body.status || "draft";
  if (!STATUSES.includes(status)) {
    return { error: `status must be one of: ${STATUSES.join(", ")}` };
  }

  const content = body.content || {};
  const headline = (content.headline || "").trim();
  const ctaLabel = (content.cta?.label || "").trim();
  if (!headline) return { error: "content.headline is required" };
  if (!ctaLabel) return { error: "content.cta.label is required" };

  const defaultSelected = content.cards?.defaultSelected === "monthly" ? "monthly" : "annual";
  const trustBadges = Array.isArray(content.trustBadges)
    ? content.trustBadges.map((b) => String(b).trim()).filter(Boolean)
    : [];

  return {
    key,
    name,
    status,
    priceSetKey: body.priceSetKey?.trim() || null,
    content: {
      eyebrow: (content.eyebrow || "").trim(),
      headline,
      subheadline: (content.subheadline || "").trim(),
      showChecklistAnimation: content.showChecklistAnimation !== false,
      showPersonalReflection: content.showPersonalReflection !== false,
      cards: {
        showMonthly: content.cards?.showMonthly !== false,
        showAnnual: content.cards?.showAnnual !== false,
        defaultSelected,
        monthly: parseCard(content.cards?.monthly),
        annual: parseCard(content.cards?.annual),
      },
      cta: { label: ctaLabel },
      trustBadges,
    },
  };
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as VariantBody | null;
  const parsed = parseBody(body);
  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const existing = await prisma.paywallVariant.findUnique({
    where: { key: parsed.key },
    select: { id: true },
  });
  if (existing) {
    return NextResponse.json(
      { error: "A variant with that key already exists" },
      { status: 409 },
    );
  }

  const variant = await prisma.paywallVariant.create({
    data: {
      key: parsed.key,
      name: parsed.name,
      status: parsed.status,
      priceSetKey: parsed.priceSetKey,
      content: parsed.content as Prisma.InputJsonValue,
    },
  });

  return NextResponse.json({ variant }, { status: 201 });
}

export async function PUT(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as (VariantBody & { id?: string }) | null;
  if (!body?.id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const parsed = parseBody(body);
  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const existing = await prisma.paywallVariant.findUnique({ where: { id: body.id } });
  if (!existing) {
    return NextResponse.json({ error: "Variant not found" }, { status: 404 });
  }

  if (existing.key !== parsed.key) {
    const keyTaken = await prisma.paywallVariant.findUnique({
      where: { key: parsed.key },
      select: { id: true },
    });
    if (keyTaken) {
      return NextResponse.json(
        { error: "A variant with that key already exists" },
        { status: 409 },
      );
    }
  }

  // STEP 1: every save bumps the version, even if content is byte-identical —
  // callers (e.g. Pellow's cache) key off version, not a content diff.
  const variant = await prisma.paywallVariant.update({
    where: { id: body.id },
    data: {
      key: parsed.key,
      name: parsed.name,
      status: parsed.status,
      priceSetKey: parsed.priceSetKey,
      content: parsed.content as Prisma.InputJsonValue,
      version: { increment: 1 },
    },
  });

  return NextResponse.json({ variant });
}
