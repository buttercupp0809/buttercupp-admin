import { NextRequest, NextResponse } from "next/server";
import { validateDodoProducts, type DodoProductsMap } from "@/lib/dodo";

// Used by the price-set editor's "Validate against Dodo" button, ahead of
// save. The price-sets POST/PUT routes re-run this same check server-side,
// so this endpoint is purely for editor feedback — it never persists.
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as
    | { dodoProducts?: DodoProductsMap }
    | null;

  if (!body?.dodoProducts || typeof body.dodoProducts !== "object") {
    return NextResponse.json({ error: "dodoProducts is required" }, { status: 400 });
  }

  const { results, valid } = await validateDodoProducts(body.dodoProducts);
  return NextResponse.json({ valid, results });
}
