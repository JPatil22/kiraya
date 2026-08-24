import { z } from "zod";

/** Strip everything but digits. */
const digits = (s: string) => s.replace(/\D/g, "");

/**
 * Indian mobile: 10 digits starting 6–9. Accepts input with spaces, +91, or a
 * leading 0/91 and normalises. `.value` after parse is the bare 10-digit number.
 */
export const indianMobileSchema = z
  .string()
  .transform((s) => {
    let d = digits(s);
    if (d.length === 12 && d.startsWith("91")) d = d.slice(2);
    if (d.length === 11 && d.startsWith("0")) d = d.slice(1);
    return d;
  })
  .refine((d) => /^[6-9]\d{9}$/.test(d), {
    message: "Enter a valid 10-digit Indian mobile number.",
  });

/** Convert a parsed 10-digit number to E.164 for Supabase (+91XXXXXXXXXX). */
export function toE164(tenDigits: string): string {
  return `+91${tenDigits}`;
}

export const otpSchema = z
  .string()
  .transform(digits)
  .refine((d) => /^\d{6}$/.test(d), { message: "Enter the 6-digit code." });

export const roleSchema = z.enum(["tenant", "owner", "broker"]);

export const bhkSchema = z.enum(["1rk", "1bhk", "2bhk", "3bhk", "4plus"]);
export const furnishingSchema = z.enum(["unfurnished", "semi", "full"]);
export const occupancySchema = z.enum([
  "family",
  "bachelors_male",
  "bachelors_female",
  "any",
]);
export const availabilitySchema = z.enum(["available", "on_hold", "rented"]);

const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

export const intentSchema = z
  .object({
    budgetMin: z.coerce
      .number({ invalid_type_error: "Enter a number" })
      .int()
      .min(1000, "Minimum budget seems too low")
      .max(100_000_000),
    budgetMax: z.coerce
      .number({ invalid_type_error: "Enter a number" })
      .int()
      .min(1000)
      .max(100_000_000),
    bhk: bhkSchema,
    moveInDate: z
      .string()
      .min(1, "Pick a move-in date")
      .refine((v) => !Number.isNaN(Date.parse(v)), "Invalid date")
      .refine((v) => new Date(v) >= startOfToday(), "Move-in date can't be in the past"),
    furnishing: furnishingSchema,
    occupancy: occupancySchema,
    notes: z.string().max(500, "Keep it under 500 characters").optional().or(z.literal("")),
  })
  .refine((v) => v.budgetMax >= v.budgetMin, {
    message: "Max budget must be ≥ min budget",
    path: ["budgetMax"],
  });

export type IntentInput = z.input<typeof intentSchema>;
export type IntentValues = z.output<typeof intentSchema>;

// ---------------------------------------------------------------------------
// MVP2 — listings
// ---------------------------------------------------------------------------

const rupees = (max = 100_000_000) =>
  z.coerce
    .number({ invalid_type_error: "Enter a number" })
    .int("Whole rupees only")
    .min(0, "Can't be negative")
    .max(max);

/**
 * Listing create/edit. Cost is captured as separate components on purpose —
 * a single blurred "price" is the thing this product exists to eliminate.
 */
export const listingSchema = z.object({
  title: z
    .string()
    .trim()
    .min(4, "Give it a clear title")
    .max(120, "Keep the title under 120 characters"),
  description: z.string().trim().max(2000, "Keep it under 2000 characters").optional().or(z.literal("")),
  addressLine: z.string().trim().max(200, "Keep it under 200 characters").optional().or(z.literal("")),
  bhk: bhkSchema,
  furnishing: furnishingSchema,
  occupancy: occupancySchema,
  rent: rupees().refine((v) => v >= 1000, "Rent looks too low"),
  deposit: rupees(),
  maintenanceMonthly: rupees(10_000_000),
  brokerage: rupees(),
  oneTimeCharges: rupees(),
  availableFrom: z
    .string()
    .min(1, "Pick an available-from date")
    .refine((v) => !Number.isNaN(Date.parse(v)), "Invalid date"),
  availability: availabilitySchema,
});

export type ListingValues = z.output<typeof listingSchema>;

// ---------------------------------------------------------------------------
// MVP3 — mismatch reports
// ---------------------------------------------------------------------------

export const mismatchTypeSchema = z.enum([
  "price_higher",
  "already_rented",
  "wrong_furnishing",
  "wrong_details",
  "unreachable",
  "other",
]);

/** A tenant reporting that reality didn't match the listing. */
export const mismatchSchema = z.object({
  propertyId: z.string().min(1, "Missing listing"),
  type: mismatchTypeSchema,
  description: z
    .string()
    .trim()
    .max(500, "Keep it under 500 characters")
    .optional()
    .or(z.literal("")),
});

// ---------------------------------------------------------------------------
// MVP4 — broker suggestions
// ---------------------------------------------------------------------------

/** A broker suggesting one live listing to one active tenant intent. */
export const suggestionSchema = z.object({
  tenantIntentId: z.string().min(1, "Pick a tenant to suggest to"),
  propertyId: z.string().min(1, "Pick one of your live listings"),
  message: z
    .string()
    .trim()
    .max(500, "Keep it under 500 characters")
    .optional()
    .or(z.literal("")),
});

/** What a tenant can do to a suggestion they received. */
export const suggestionResponseSchema = z.enum(["accepted", "declined", "not_relevant"]);

/** Feed filters. Everything optional; `any` means "no filter". */
export const listingFilterSchema = z.object({
  bhk: bhkSchema.or(z.literal("any")).catch("any"),
  availability: availabilitySchema.or(z.literal("any")).catch("any"),
  furnishing: furnishingSchema.or(z.literal("any")).catch("any"),
  // "any" here means "don't filter". The listing's own `occupancy_pref = any`
  // is a different thing — a landlord who'll take anyone — and the feed has to
  // keep those visible whatever the tenant picks. See getPublicListings.
  occupancy: occupancySchema.or(z.literal("any")).catch("any"),
  minBudget: z.coerce.number().int().min(0).max(100_000_000).optional().catch(undefined),
  maxBudget: z.coerce.number().int().min(0).max(100_000_000).optional().catch(undefined),
  freshOnly: z
    .union([z.literal("1"), z.literal("0"), z.literal("on"), z.literal("")])
    .transform((v) => v === "1" || v === "on")
    .catch(false),
  sort: z.enum(["verified", "recent", "price_asc", "price_desc"]).catch("verified"),
  /** Free text over title / description / address. Sanitised in listings.ts. */
  q: z.string().trim().max(80).optional().catch(undefined),
  /** Area slug, or "any". Validated against the DB, not an enum — areas are data. */
  area: z.string().trim().max(60).optional().catch(undefined),
  /** 1-based. Out-of-range values fall back to the first page rather than 404. */
  page: z.coerce.number().int().min(1).max(500).catch(1),
});

export type ListingFilters = z.output<typeof listingFilterSchema>;
