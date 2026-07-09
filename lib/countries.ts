/**
 * Valid ISO-2 country codes for paywall rule country-scoping. Copied from the
 * Pellow PPP map (frontend/lib/pricing/ppp.ts COUNTRY_TO_TIER keys) since admin
 * does not import from the Pellow frontend. Labels are resolved via
 * Intl.DisplayNames so we don't hand-maintain a name table.
 */
const CODES = [
  // T0
  "US", "CA", "AU", "NZ", "GB", "IE", "CH", "NO", "DK", "SE", "FI", "IS", "LU",
  "AE", "QA", "KW", "BH", "SG", "HK",
  // T1
  "DE", "FR", "NL", "BE", "AT", "IT", "ES", "PT", "IL", "JP", "KR", "TW", "SI",
  "MT", "CY", "EE",
  // T2
  "CZ", "GR", "HU", "SK", "PL", "HR", "RO", "BG", "LT", "LV", "SA", "OM", "MX",
  "CL", "UY", "CR", "PA",
  // T3
  "TR", "BR", "AR", "ZA", "RU", "TH", "MY", "CN", "RS", "EC", "CO", "PE", "DO",
  "JM", "KZ",
  // T4
  "IN", "ID", "PH", "VN", "EG", "MA", "KE", "NG", "BD", "PK", "LK", "KH", "MM",
  "GH", "ET", "UA", "BO", "GT", "HN", "NP", "TZ", "UG", "RW",
] as const;

export interface CountryOption {
  code: string;
  label: string;
}

const regionNames = (() => {
  try {
    return new Intl.DisplayNames(["en"], { type: "region" });
  } catch {
    return null;
  }
})();

export const COUNTRIES: CountryOption[] = CODES.map((code) => ({
  code,
  label: regionNames?.of(code) ?? code,
})).sort((a, b) => a.label.localeCompare(b.label));

const CODE_SET = new Set<string>(CODES);

export function isValidCountryCode(code: string): boolean {
  return CODE_SET.has(code.toUpperCase());
}
