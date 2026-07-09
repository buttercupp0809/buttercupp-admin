
## PHASE 5, Admin (vesspr-admin repo)

> All prompts `[ADMIN]` run in `/Users/kshitijpratap/Documents/Projects/vesspr-admin`. Reuse `lib/prisma.ts`, existing `(admin)` route group + `vesspr-admin-token` middleware, and the `funnel` page as the pattern template. Match the existing shadcn/Tailwind style.

### PROMPT 5.1: Schema sync + seed

**Files:** `vesspr-admin/prisma/schema.prisma`
**Priority:** Critical
**Depends on:** Pellow 0.1 migration applied to shared Neon

#### >>> COPY-PASTE PROMPT START
```
[ADMIN] Mirror the paywall schema so the admin Prisma client knows the new models/columns.

- Copy the exact PaywallPriceSet, PaywallVariant, PaywallRule models and the User/Subscription
  column additions from the Pellow schema (master-prd-21 §7) into vesspr-admin/prisma/schema.prisma.
- Run `npx prisma generate` ONLY. DO NOT run a migration (DDL already applied by Pellow Phase 0
  against the shared Neon DB).
- Add a one-off seed (script or admin action) that upserts:
  - PaywallVariant { key: "control", name: "Control", status: "active", content: {} }
  - PaywallPriceSet { key: "default", label: "Default (env PPP)", dodoProducts: {} , active: true }
```
#### >>> COPY-PASTE PROMPT END

#### VALIDATE BEFORE MOVING ON
- [ ] `npx prisma generate` succeeds in admin.
- [ ] Admin app builds/typechecks.
- [ ] `control` variant + `default` price set exist in the DB.

#### EDGE CASES
- No migration run from admin (drift avoided per PRD-20 runbook).

---

### PROMPT 5.2: Price sets + Dodo validation

**Files:** `vesspr-admin/app/(admin)/paywall/price-sets/page.tsx`, `vesspr-admin/app/api/paywall/price-sets/route.ts`, `vesspr-admin/app/api/paywall/validate-dodo/route.ts`
**Priority:** Critical
**Depends on:** 5.1

#### >>> COPY-PASTE PROMPT START
```
[ADMIN] Build the price-set catalog with Dodo validation (this is the display=charge guard).

STEP 1, GET/POST/PUT /api/paywall/price-sets: list + create + update PaywallPriceSet via
lib/prisma. Body: key, label, active, dodoProducts (per-tier { monthly, annual } product IDs).

STEP 2, POST /api/paywall/validate-dodo: given dodoProducts, call the Dodo API
(client.products.retrieve for each id, using DODO_API_KEY) and return each id's
{ ok, priceCents, currency, interval } or an error. On price-set save, require validation to
pass for every listed id; store the results into priceSnapshot + lastValidated. Reject save if
any id is invalid, or currency/interval mismatches the intended monthly/annual slot.

STEP 3, page.tsx: table of price sets (key, label, active, per-tier prices from snapshot,
lastValidated). Create/edit form with a "Validate against Dodo" button before save.
```
#### >>> COPY-PASTE PROMPT END

#### VALIDATE BEFORE MOVING ON
- [ ] Create a price set with real T0 monthly/annual product IDs → validation shows correct prices, save succeeds.
- [ ] Invalid product id → validation error, save blocked.
- [ ] Admin auth still required (middleware).

#### EDGE CASES
- Partial tier map (only T0) allowed; other tiers fall back to env at runtime.
- Snapshot is display-only; runtime price still read live (E20).

---

### PROMPT 5.2b: Create a new Dodo product from admin (price + trial, self-serve)

**Files:** `vesspr-admin/app/api/paywall/dodo-products/create/route.ts` (create), `vesspr-admin/app/(admin)/paywall/price-sets/page.tsx` (extend the editor)
**Priority:** High
**Depends on:** 5.2

> VERIFIED: Dodo supports product creation via `POST /products`
> (https://docs.dodopayments.com/api-reference/products/post-products). Confirmed 2026-07-08.
> This mints a BRAND-NEW product every call. It NEVER mutates an existing product (prices are
> effectively immutable, and a live product is shared by existing subscribers). Marketing sets a
> price + trial, gets new product IDs, and those are registered into a price set. This is a WRITE
> call to the payment provider, gated by admin JWT and a deliberate button, not auto-fired.

#### >>> COPY-PASTE PROMPT START
```
[ADMIN] Add a "Create new Dodo product" action so marketing can mint a price point (price +
free-trial days) without the Dodo dashboard or an engineer. Create-only, never update.

STEP 1, POST /api/paywall/dodo-products/create (admin-gated, uses the Dodo SDK + DODO_API_KEY;
honor DODO_ENVIRONMENT test_mode/live_mode exactly like lib/payments/dodo.ts in Pellow):
Body: { label: string, interval: "monthly" | "annual", priceCents: number, trialPeriodDays: number }.
Build the Dodo create-product payload (verified schema):
  name: label + " (" + interval + ")"
  tax_category: "saas"
  price: {
    type: "recurring_price",
    currency: "USD",
    price: priceCents,                        // lowest denomination (cents). For annual, this is
                                              // the FULL YEARLY total (e.g. 14400 = $144/yr).
    discount: 0,
    purchasing_power_parity: false,           // we manage PPP ourselves via per-tier price sets
    payment_frequency_interval: interval === "annual" ? "Year" : "Month",
    payment_frequency_count: 1,
    subscription_period_interval: interval === "annual" ? "Year" : "Month",
    subscription_period_count: 1,
    trial_period_days: trialPeriodDays        // 0 = no trial
  }
Call client.products.create(payload). Return { productId: res.product_id, priceCents,
trialPeriodDays, interval, environment }.
Wrap in try/catch; on failure return { error } with the Dodo message (server-log full, return a
short message to the client). Timeout the call (reuse the pattern in lib/backend.ts).

STEP 2, price-set editor: for each PPP tier's monthly/annual slot, next to the manual "product ID"
input add a "Create new product" mini-form (price in dollars -> *100 to cents; for annual accept
the yearly total; trial days, default 5). On success, drop the returned productId into the slot,
then the existing "Validate against Dodo" (Prompt 5.2) confirms and snapshots it. Show the
environment (test/live) badge so no one creates a test product for a live set.

CONSTRAINTS:
- Create only. No update/delete of Dodo products from admin.
- Do not auto-create on save; only on the explicit button.
- Never expose DODO_API_KEY to the client; all Dodo calls are server-side in the route.
```
#### >>> COPY-PASTE PROMPT END

#### VALIDATE BEFORE MOVING ON
- [ ] Create a monthly product at $19, trial 5 → returns a `product_id`; validation shows $19 + trial.
- [ ] Create an annual product at $144/yr → product created with `Year`/`Year` intervals, price 14400.
- [ ] Wrong `DODO_ENVIRONMENT` produces a test product with a clear test badge, not a live one.
- [ ] Route is 401 without the admin cookie.

#### EDGE CASES
- Dodo API error → surfaced in the form, no partial price-set save.
- Created product still must pass Prompt 5.2 validation before the price set is saved (single source of truth = the live product).
- Annual price field is the yearly total (matches how `fetchDodoPlanPrices` divides by 12 for the per-month display).

---

### PROMPT 5.3: Variants editor + live preview

**Files:** `vesspr-admin/app/(admin)/paywall/variants/page.tsx`, `.../variants/[key]/page.tsx`, `vesspr-admin/app/api/paywall/variants/route.ts`
**Priority:** Critical
**Depends on:** 5.2

#### >>> COPY-PASTE PROMPT START
```
[ADMIN] Build the variant editor. Typed form fields, NOT raw JSON. On save, bump version.

STEP 1, GET/POST/PUT /api/paywall/variants: list + create + update PaywallVariant. On update,
increment version. Persist content as the PaywallContent partial.

STEP 2, editor form fields (all map to content): eyebrow, headline, subheadline, toggles
(showChecklistAnimation, showPersonalReflection), per-card (showMonthly, showAnnual, badgeText,
anchorPrice, recommended), defaultSelected select, cta.label, trustBadges (add/remove list),
priceSetKey (select from active price sets, plus "none = default PPP"), status select
(draft/active/archived). Label anchorPrice clearly as "Display-only strikethrough (not charged)".

STEP 3, "Preview" button: opens
  {VESSPR_ORIGIN}/onboard/payment?paywall_preview={key}&sig={hmac}&exp={ts}
where sig = HMAC-SHA256 over `${key}.${exp}` using PAYWALL_PREVIEW_SECRET (same value both
projects). Open in a new tab. VESSPR_ORIGIN from an env (e.g. NEXT_PUBLIC_VESSPR_ORIGIN).
```
#### >>> COPY-PASTE PROMPT END

#### VALIDATE BEFORE MOVING ON
- [ ] Create a variant, set headline + annual-only, save → version increments.
- [ ] Preview opens the real Vesspr payment page showing the variant, no cookie set, no analytics.
- [ ] Draft variant only visible via preview, never assigned to live traffic.

#### EDGE CASES
- Preview sig invalid/expired → Vesspr renders normally (E16), verified by editing the URL.

---

### PROMPT 5.4: Rules editor + kill switch

**Files:** `vesspr-admin/app/(admin)/paywall/rules/page.tsx`, `vesspr-admin/app/api/paywall/rules/route.ts`
**Priority:** Critical
**Depends on:** 5.3

#### >>> COPY-PASTE PROMPT START
```
[ADMIN] Build the campaign->variant linkage editor. This is where a campaign is bound to a UI.

STEP 1, GET/POST/PUT /api/paywall/rules: list + create + update PaywallRule (version bump on
update). Validate on save: every arm.variantKey must reference an ACTIVE variant; weights sum > 0;
priority is an int.

STEP 2, page.tsx form: key (usually the utm_campaign value), name, matchCampaigns (chips),
matchVariantParams (chips), countryIn (optional ISO-2 chips), priority, status toggle live/off
(the kill switch), and a SINGLE variant select (direct pin). v1 UI is direct-pin only: on save,
write arms = [{ variantKey: <selected>, weight: 100 }]. Do NOT expose multi-arm/weight inputs
yet (the schema + resolver support them; the UI does not in v1). Warn (non-blocking) if two
live rules share a campaign key (E14).

STEP 3, a prominent "Turn all rules OFF" safety action that sets every rule status="off"
(instant global revert to control, no deploy).
```
#### >>> COPY-PASTE PROMPT END

#### VALIDATE BEFORE MOVING ON
- [ ] Create rule `key=black_friday`, matchCampaigns [black_friday], single arm → variant. Load Vesspr with `?utm_campaign=black_friday` → variant renders.
- [ ] Flip rule to off → Vesspr renders control (kill switch).
- [ ] Arm pointing at a draft variant → save blocked.

#### EDGE CASES
- Overlapping campaign keys warned (E14).
- countryIn scopes a rule to paid-ad markets only (E11).

---

### PROMPT 5.5: Results view + sidebar link

**Files:** `vesspr-admin/app/(admin)/paywall/results/page.tsx`, `vesspr-admin/app/api/paywall/results/route.ts`, `vesspr-admin/components/sidebar.tsx`
**Priority:** High
**Depends on:** 5.4, Pellow 4.2 (events tagged)

#### >>> COPY-PASTE PROMPT START
```
[ADMIN] Build conversion-by-variant results, reusing the funnel page patterns.

STEP 1, GET /api/paywall/results?days=7|14|30|90: query AnalyticsEvent (lib/prisma) for
paywall_viewed, begin_checkout, purchase where properties.paywall_variant_key is set. Group by
paywall_variant_key (and optionally paywall_rule_key). Return per-variant { views, checkouts,
purchases, viewToPurchasePct }. Compute a simple two-proportion z-test flag vs the "control"
variant and return { significant: bool, direction }.

STEP 2, results page: shadcn Table with date-range Tabs (7/14/30/90), one row per variant,
conversion %, and a significance badge vs control. Reuse recharts if a trend is easy.

STEP 3, add a "Paywall" section/link to components/sidebar.tsx pointing at /paywall (with the
sub-pages price-sets/variants/rules/results).
```
#### >>> COPY-PASTE PROMPT END

#### VALIDATE BEFORE MOVING ON
- [ ] Results page shows counts per variant for a date range.
- [ ] Numbers reconcile with raw AnalyticsEvent counts (spot check one variant).
- [ ] Sidebar link works, gated by admin auth.

#### EDGE CASES
- Variant with 0 views → row shows 0s, no divide-by-zero.
- Only control has data → renders, no significance claim.

---
