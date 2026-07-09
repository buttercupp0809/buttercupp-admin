import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  buildPriceSnapshot,
  validateDodoProducts,
  type DodoProductsMap,
} from "@/lib/dodo";

export async function GET() {
  const priceSets = await prisma.paywallPriceSet.findMany({
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json({ priceSets });
}

interface PriceSetBody {
  key?: string;
  label?: string;
  active?: boolean;
  dodoProducts?: DodoProductsMap;
}

interface ParsedPriceSet {
  key: string;
  label: string;
  active: boolean;
  dodoProducts: DodoProductsMap;
}

function parseBody(body: PriceSetBody | null): ParsedPriceSet | { error: string } {
  if (!body) return { error: "Invalid JSON" };

  const key = (body.key || "").trim();
  const label = (body.label || "").trim();
  if (!key) return { error: "key is required" };
  if (!/^[a-z0-9_-]+$/i.test(key)) {
    return { error: "key must be alphanumeric (dashes/underscores allowed)" };
  }
  if (!label) return { error: "label is required" };

  const dodoProducts: DodoProductsMap =
    body.dodoProducts && typeof body.dodoProducts === "object" ? body.dodoProducts : {};
  const hasAnyProduct = Object.values(dodoProducts).some(
    (slots) => slots && (slots.monthly || slots.annual),
  );
  if (!hasAnyProduct) {
    return { error: "At least one Dodo product ID is required" };
  }

  return { key, label, active: body.active !== false, dodoProducts };
}

// Shared by POST/PUT: re-validates every listed product against Dodo before
// persisting (defense in depth — the UI's "Validate against Dodo" button is
// not trusted as the sole gate). Save is rejected unless every listed id
// passes, per Prompt 5.2's display=charge guard.
async function validateAndSnapshot(parsed: ParsedPriceSet) {
  const { results, valid } = await validateDodoProducts(parsed.dodoProducts);
  if (!valid) {
    return {
      error: NextResponse.json(
        { error: "Dodo validation failed for one or more products", results },
        { status: 422 },
      ),
    };
  }
  return {
    priceSnapshot: buildPriceSnapshot(parsed.dodoProducts, results),
    results,
  };
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as PriceSetBody | null;
  const parsed = parseBody(body);
  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const existing = await prisma.paywallPriceSet.findUnique({
    where: { key: parsed.key },
    select: { id: true },
  });
  if (existing) {
    return NextResponse.json(
      { error: "A price set with that key already exists" },
      { status: 409 },
    );
  }

  const validation = await validateAndSnapshot(parsed);
  if ("error" in validation) return validation.error;

  const priceSet = await prisma.paywallPriceSet.create({
    data: {
      key: parsed.key,
      label: parsed.label,
      active: parsed.active,
      dodoProducts: parsed.dodoProducts,
      priceSnapshot: validation.priceSnapshot,
      lastValidated: new Date(),
    },
  });

  return NextResponse.json({ priceSet, results: validation.results }, { status: 201 });
}

export async function PUT(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as (PriceSetBody & { id?: string }) | null;
  if (!body?.id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const parsed = parseBody(body);
  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const existing = await prisma.paywallPriceSet.findUnique({ where: { id: body.id } });
  if (!existing) {
    return NextResponse.json({ error: "Price set not found" }, { status: 404 });
  }

  if (existing.key !== parsed.key) {
    const keyTaken = await prisma.paywallPriceSet.findUnique({
      where: { key: parsed.key },
      select: { id: true },
    });
    if (keyTaken) {
      return NextResponse.json(
        { error: "A price set with that key already exists" },
        { status: 409 },
      );
    }
  }

  const validation = await validateAndSnapshot(parsed);
  if ("error" in validation) return validation.error;

  const priceSet = await prisma.paywallPriceSet.update({
    where: { id: body.id },
    data: {
      key: parsed.key,
      label: parsed.label,
      active: parsed.active,
      dodoProducts: parsed.dodoProducts,
      priceSnapshot: validation.priceSnapshot,
      lastValidated: new Date(),
    },
  });

  return NextResponse.json({ priceSet, results: validation.results });
}
