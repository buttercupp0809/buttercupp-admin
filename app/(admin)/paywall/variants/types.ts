// Mirrors Pellow's frontend/lib/paywall/types.ts PaywallContent. The DB column is a
// Partial<PaywallContent>, but the admin form always fills every field it renders.
export interface PaywallCardContent {
  badgeText: string | null;
  anchorPrice: string | null;
  recommended: boolean;
}

export interface PaywallContent {
  eyebrow: string;
  headline: string;
  subheadline: string;
  showChecklistAnimation: boolean;
  showPersonalReflection: boolean;
  cards: {
    showMonthly: boolean;
    showAnnual: boolean;
    defaultSelected: "monthly" | "annual";
    monthly: PaywallCardContent;
    annual: PaywallCardContent;
  };
  cta: { label: string };
  trustBadges: string[];
}

export type VariantStatus = "draft" | "active" | "archived";

export interface PaywallVariant {
  id: string;
  key: string;
  name: string;
  status: VariantStatus;
  priceSetKey: string | null;
  content: Partial<PaywallContent>;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export const DEFAULT_CONTENT: PaywallContent = {
  eyebrow: "Last step",
  headline: "Start your 5-day free trial",
  subheadline: "$0 today. Cancel anytime.",
  showChecklistAnimation: true,
  showPersonalReflection: true,
  cards: {
    showMonthly: true,
    showAnnual: true,
    defaultSelected: "annual",
    monthly: { badgeText: null, anchorPrice: "$25", recommended: false },
    annual: { badgeText: "Recommended", anchorPrice: null, recommended: true },
  },
  cta: { label: "Start free trial · $0 due today" },
  trustBadges: ["Secured by Dodo · Cancel in one tap", "★★★★★ Loved by 12,000+ people"],
};

// Fills any gaps left by a Partial<PaywallContent> so the form always has every
// field defined — mirrors the fallback behavior of Pellow's mergeContent().
export function mergeWithDefaults(partial: Partial<PaywallContent> | null | undefined): PaywallContent {
  if (!partial) return structuredClone(DEFAULT_CONTENT);
  const cards = (partial.cards ?? {}) as Partial<PaywallContent["cards"]>;
  return {
    eyebrow: partial.eyebrow ?? DEFAULT_CONTENT.eyebrow,
    headline: partial.headline ?? DEFAULT_CONTENT.headline,
    subheadline: partial.subheadline ?? DEFAULT_CONTENT.subheadline,
    showChecklistAnimation: partial.showChecklistAnimation ?? DEFAULT_CONTENT.showChecklistAnimation,
    showPersonalReflection: partial.showPersonalReflection ?? DEFAULT_CONTENT.showPersonalReflection,
    cards: {
      showMonthly: cards.showMonthly ?? DEFAULT_CONTENT.cards.showMonthly,
      showAnnual: cards.showAnnual ?? DEFAULT_CONTENT.cards.showAnnual,
      defaultSelected: cards.defaultSelected ?? DEFAULT_CONTENT.cards.defaultSelected,
      monthly: {
        badgeText: cards.monthly?.badgeText ?? DEFAULT_CONTENT.cards.monthly.badgeText,
        anchorPrice: cards.monthly?.anchorPrice ?? DEFAULT_CONTENT.cards.monthly.anchorPrice,
        recommended: cards.monthly?.recommended ?? DEFAULT_CONTENT.cards.monthly.recommended,
      },
      annual: {
        badgeText: cards.annual?.badgeText ?? DEFAULT_CONTENT.cards.annual.badgeText,
        anchorPrice: cards.annual?.anchorPrice ?? DEFAULT_CONTENT.cards.annual.anchorPrice,
        recommended: cards.annual?.recommended ?? DEFAULT_CONTENT.cards.annual.recommended,
      },
    },
    cta: { label: partial.cta?.label ?? DEFAULT_CONTENT.cta.label },
    trustBadges: partial.trustBadges ?? DEFAULT_CONTENT.trustBadges,
  };
}
