import type {
  AvailabilityStatus,
  BhkType,
  FurnishingType,
  ListingStatus,
  MismatchType,
  OccupancyType,
  SuggestionStatus,
  UserRole,
} from "@/types/database";

/** Selectable roles at onboarding (admin is never self-selectable). */
export const ROLE_OPTIONS: {
  value: Exclude<UserRole, "admin">;
  label: string;
  description: string;
}[] = [
  { value: "tenant", label: "I'm looking to rent", description: "Find verified, fresh listings and tell brokers exactly what you want." },
  { value: "owner", label: "I own a property", description: "List your unit and reach verified tenants — no broker markup." },
  { value: "broker", label: "I'm a broker", description: "See verified demand and suggest real listings, transparently." },
];

export const BHK_OPTIONS: { value: BhkType; label: string }[] = [
  { value: "1rk", label: "1 RK" },
  { value: "1bhk", label: "1 BHK" },
  { value: "2bhk", label: "2 BHK" },
  { value: "3bhk", label: "3 BHK" },
  { value: "4plus", label: "4+ BHK" },
];

export const FURNISHING_OPTIONS: { value: FurnishingType; label: string }[] = [
  { value: "unfurnished", label: "Unfurnished" },
  { value: "semi", label: "Semi-furnished" },
  { value: "full", label: "Fully furnished" },
];

export const OCCUPANCY_OPTIONS: { value: OccupancyType; label: string }[] = [
  { value: "family", label: "Family" },
  { value: "bachelors_male", label: "Bachelors (male)" },
  { value: "bachelors_female", label: "Bachelors (female)" },
  { value: "any", label: "No preference" },
];

export const AVAILABILITY_OPTIONS: { value: AvailabilityStatus; label: string }[] = [
  { value: "available", label: "Available" },
  { value: "on_hold", label: "On hold" },
  { value: "rented", label: "Rented out" },
];

/** Listing lifecycle labels — shared by the dashboard, admin queue and timeline. */
export const LISTING_STATUS: Record<
  ListingStatus,
  { label: string; variant: "default" | "secondary" | "outline" | "destructive" | "success" | "warning" }
> = {
  draft: { label: "Draft", variant: "outline" },
  pending_review: { label: "In review", variant: "warning" },
  live: { label: "Live", variant: "success" },
  rejected: { label: "Rejected", variant: "destructive" },
  archived: { label: "Archived", variant: "outline" },
};

export const SORT_OPTIONS = [
  { value: "verified", label: "Freshest first" },
  { value: "recent", label: "Newest first" },
  { value: "price_asc", label: "Price: low to high" },
  { value: "price_desc", label: "Price: high to low" },
] as const;

/** "posted by" badge copy — authorship is a first-class trust signal. */
export const POSTED_BY_LABEL: Record<UserRole, string> = {
  owner: "Posted by owner",
  broker: "Posted by broker",
  admin: "Posted by Kiraya",
  tenant: "Posted by tenant",
};

export function labelFor<T extends string>(
  options: { value: T; label: string }[],
  value: T | null | undefined,
): string {
  return options.find((o) => o.value === value)?.label ?? "—";
}

// ---------------------------------------------------------------------------
// MVP3 — history & mismatch
// ---------------------------------------------------------------------------

/** What a tenant found when reality didn't match the listing. */
export const MISMATCH_OPTIONS: { value: MismatchType; label: string; hint: string }[] = [
  { value: "price_higher", label: "Price was higher", hint: "Quoted more than the listing says" },
  { value: "already_rented", label: "Already rented", hint: "The unit is gone" },
  { value: "wrong_furnishing", label: "Furnishing was wrong", hint: "Not as described" },
  { value: "wrong_details", label: "Other details wrong", hint: "BHK, address, occupancy…" },
  { value: "unreachable", label: "Couldn't reach anyone", hint: "No response on the number" },
  { value: "other", label: "Something else", hint: "Tell us below" },
];

/** Human labels for the columns the 0003 audit trigger records. */
export const UPDATE_FIELD_LABEL: Record<string, string> = {
  rent: "Rent",
  deposit: "Security deposit",
  maintenance_monthly: "Maintenance",
  brokerage: "Brokerage",
  one_time_charges: "Other one-time charges",
  availability: "Availability",
  available_from: "Available from",
  furnishing: "Furnishing",
  occupancy_pref: "Occupancy",
  last_verified_at: "Verification",
  status: "Listing status",
};

/** Money columns render as rupees; the rest are enums or dates. */
export const MONEY_FIELDS = new Set([
  "rent",
  "deposit",
  "maintenance_monthly",
  "brokerage",
  "one_time_charges",
]);

// ---------------------------------------------------------------------------
// MVP4 — broker suggestions
// ---------------------------------------------------------------------------

export const SUGGESTION_STATUS: Record<
  SuggestionStatus,
  { label: string; variant: "default" | "secondary" | "outline" | "destructive" | "success" | "warning" }
> = {
  sent: { label: "Sent", variant: "secondary" },
  viewed: { label: "Viewed", variant: "outline" },
  accepted: { label: "Accepted", variant: "success" },
  declined: { label: "Declined", variant: "destructive" },
  not_relevant: { label: "Not relevant", variant: "outline" },
  withdrawn: { label: "Withdrawn", variant: "outline" },
};
