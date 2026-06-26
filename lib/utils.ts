import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: string | Date): string {
  const d = new Date(date);
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function formatDateTime(date: string | Date): string {
  const d = new Date(date);
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const COUNTRY_DISPLAY =
  typeof Intl !== "undefined" && "DisplayNames" in Intl
    ? new Intl.DisplayNames(["en"], { type: "region" })
    : null;

export function formatCountry(code: string | null | undefined): string {
  if (!code) return "Unknown";
  const trimmed = code.trim();
  if (!trimmed) return "Unknown";
  if (trimmed.toLowerCase() === "unknown") return "Unknown";
  // Only ISO alpha-2 codes resolve via Intl. Anything else (already a name,
  // free-text) falls through unchanged.
  if (/^[A-Za-z]{2}$/.test(trimmed) && COUNTRY_DISPLAY) {
    try {
      const name = COUNTRY_DISPLAY.of(trimmed.toUpperCase());
      if (name && name !== trimmed.toUpperCase()) return name;
    } catch {
      // fall through
    }
  }
  return trimmed;
}
