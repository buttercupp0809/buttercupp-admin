import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isValidCountryCode } from "@/lib/countries";

// v1 direct-pin UI only: a rule always has exactly one arm at weight 100.
// The schema/resolver support multi-arm weighted rollout (Pellow's pickArm),
// this API just never writes more than one arm yet (master-prd-21 Prompt 5.4).
interface Arm {
  variantKey: string;
  weight: number;
}

interface RuleBody {
  key?: string;
  name?: string;
  status?: string;
  matchCampaigns?: string[];
  matchVariantParams?: string[];
  countryIn?: string[];
  priority?: number;
  variantKey?: string; // single direct-pin selection, converted to arms below
}

interface ParsedRule {
  key: string;
  name: string;
  status: string;
  matchCampaigns: string[];
  matchVariantParams: string[];
  countryIn: string[];
  priority: number;
  arms: Arm[];
}

const STATUSES = ["off", "live"];

function cleanList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((v) => String(v).trim()).filter(Boolean))];
}

export async function GET() {
  const rules = await prisma.paywallRule.findMany({
    orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
  });
  return NextResponse.json({ rules });
}

async function parseBody(body: RuleBody | null): Promise<ParsedRule | { error: string }> {
  if (!body) return { error: "Invalid JSON" };

  const key = (body.key || "").trim();
  const name = (body.name || "").trim();
  if (!key) return { error: "key is required" };
  if (!/^[a-z0-9_-]+$/i.test(key)) {
    return { error: "key must be alphanumeric (dashes/underscores allowed)" };
  }
  if (!name) return { error: "name is required" };

  const status = body.status || "off";
  if (!STATUSES.includes(status)) {
    return { error: `status must be one of: ${STATUSES.join(", ")}` };
  }

  const matchCampaigns = cleanList(body.matchCampaigns);
  const matchVariantParams = cleanList(body.matchVariantParams);
  const countryIn = cleanList(body.countryIn).map((c) => c.toUpperCase());
  for (const code of countryIn) {
    if (!isValidCountryCode(code)) {
      return { error: `Invalid country code: "${code}"` };
    }
  }

  const priority = Number.isInteger(body.priority) ? (body.priority as number) : NaN;
  if (!Number.isInteger(priority)) {
    return { error: "priority must be an integer" };
  }

  const variantKey = (body.variantKey || "").trim();
  if (!variantKey) {
    return { error: "A variant must be selected" };
  }

  // Every arm.variantKey must reference an ACTIVE variant (Prompt 5.4 STEP 1).
  const variant = await prisma.paywallVariant.findUnique({
    where: { key: variantKey },
    select: { status: true },
  });
  if (!variant || variant.status !== "active") {
    return { error: "Selected variant must exist and be active" };
  }

  const arms: Arm[] = [{ variantKey, weight: 100 }];

  return { key, name, status, matchCampaigns, matchVariantParams, countryIn, priority, arms };
}

// Non-blocking warning (E14): flags when a live rule would share a campaign
// key with another currently-live rule (excluding itself on update).
async function overlapWarning(parsed: ParsedRule, excludeId?: string): Promise<string | null> {
  if (parsed.status !== "live" || parsed.matchCampaigns.length === 0) return null;

  const others = await prisma.paywallRule.findMany({
    where: {
      status: "live",
      id: excludeId ? { not: excludeId } : undefined,
      matchCampaigns: { hasSome: parsed.matchCampaigns },
    },
    select: { key: true, matchCampaigns: true },
  });
  if (others.length === 0) return null;

  const sharedKeys = others.map((r) => r.key).join(", ");
  return `Warning: this campaign overlaps with other live rule(s): ${sharedKeys}. The lower-priority rule wins ties by most-recently-updated.`;
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as RuleBody | null;
  const parsed = await parseBody(body);
  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const existing = await prisma.paywallRule.findUnique({
    where: { key: parsed.key },
    select: { id: true },
  });
  if (existing) {
    return NextResponse.json({ error: "A rule with that key already exists" }, { status: 409 });
  }

  const warning = await overlapWarning(parsed);

  const rule = await prisma.paywallRule.create({
    data: {
      key: parsed.key,
      name: parsed.name,
      status: parsed.status,
      matchCampaigns: parsed.matchCampaigns,
      matchVariantParams: parsed.matchVariantParams,
      countryIn: parsed.countryIn,
      priority: parsed.priority,
      arms: parsed.arms as unknown as Prisma.InputJsonValue,
    },
  });

  return NextResponse.json({ rule, warning }, { status: 201 });
}

export async function PUT(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as (RuleBody & { id?: string }) | null;
  if (!body?.id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const parsed = await parseBody(body);
  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const existing = await prisma.paywallRule.findUnique({ where: { id: body.id } });
  if (!existing) {
    return NextResponse.json({ error: "Rule not found" }, { status: 404 });
  }

  if (existing.key !== parsed.key) {
    const keyTaken = await prisma.paywallRule.findUnique({
      where: { key: parsed.key },
      select: { id: true },
    });
    if (keyTaken) {
      return NextResponse.json({ error: "A rule with that key already exists" }, { status: 409 });
    }
  }

  const warning = await overlapWarning(parsed, body.id);

  const rule = await prisma.paywallRule.update({
    where: { id: body.id },
    data: {
      key: parsed.key,
      name: parsed.name,
      status: parsed.status,
      matchCampaigns: parsed.matchCampaigns,
      matchVariantParams: parsed.matchVariantParams,
      countryIn: parsed.countryIn,
      priority: parsed.priority,
      arms: parsed.arms as unknown as Prisma.InputJsonValue,
      version: { increment: 1 },
    },
  });

  return NextResponse.json({ rule, warning });
}

// The top-of-list rule (lowest priority, i.e. first tie-break winner) is kept
// non-deletable from here, mirroring the "except the default option" rule
// applied to the other two paywall tables — reprioritize before removing it.
export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const existing = await prisma.paywallRule.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Rule not found" }, { status: 404 });
  }

  const first = await prisma.paywallRule.findFirst({
    orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
    select: { id: true },
  });
  if (first?.id === id) {
    return NextResponse.json(
      { error: "The top-priority rule can't be deleted from here" },
      { status: 400 },
    );
  }

  await prisma.paywallRule.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
