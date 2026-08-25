// Hand-authored subset of the Supabase schema for MVP1 (+ enums used across
// later MVPs). Regenerate the full, exact types once your DB is linked:
//   npm run db:types   →   supabase gen types typescript --local
//
// Keeping this file small and correct is enough for MVP1 to typecheck.

export type UserRole = "tenant" | "owner" | "broker" | "admin";
export type OnboardingStep = "role" | "intent" | "done";
export type BhkType = "1rk" | "1bhk" | "2bhk" | "3bhk" | "4plus";
export type FurnishingType = "unfurnished" | "semi" | "full";
export type OccupancyType = "family" | "bachelors_male" | "bachelors_female" | "any";
export type IntentStatus = "active" | "paused" | "fulfilled";
export type AvailabilityStatus = "available" | "on_hold" | "rented";
export type ListingStatus = "draft" | "pending_review" | "live" | "rejected" | "archived";
export type UpdateKind = "price" | "availability" | "terms" | "verification" | "other";
export type MismatchType =
  | "price_higher"
  | "already_rented"
  | "wrong_furnishing"
  | "wrong_details"
  | "unreachable"
  | "other";
export type ReportStatus = "open" | "resolved" | "dismissed";
export type RoomType = "hall" | "kitchen" | "bedroom" | "bathroom" | "balcony" | "exterior";
export type ContactSource = "listing" | "suggestion";
export type VisitOutcome =
  | "as_described"
  | "did_not_match"
  | "unreachable"
  /** Carries no signal about the listing — excluded from accuracy (0015). */
  | "did_not_visit";
export type VisitStatus = "proposed" | "confirmed" | "declined" | "cancelled";
export type NotificationKind =
  | "contact_received"
  | "suggestion_received"
  | "suggestion_answered"
  | "saved_listing_changed"
  | "mismatch_reported"
  | "listing_reviewed"
  | "listing_matched"
  | "visit_proposed"
  | "visit_answered"
  | "verification_due"
  | "visit_reminder";
export type ModerationKind =
  | "approve"
  | "reject"
  | "verify"
  | "takedown"
  | "suspend_user"
  | "reinstate_user"
  | "resolve_report"
  | "dismiss_report";
export type SuggestionStatus =
  | "sent"
  | "viewed"
  | "accepted"
  | "declined"
  | "not_relevant"
  | "withdrawn";

// NOTE: these are `type` aliases, not `interface`s, on purpose. supabase-js's
// GenericTable requires `Row extends Record<string, unknown>`, and only type
// aliases get an implicit index signature — an interface here silently
// collapses the whole schema (and every query result) to `never`.
export type Locality = {
  id: string;
  slug: string;
  name: string;
  city: string;
  state: string | null;
  verify_stale_days: number;
  is_active: boolean;
  created_at: string;
};

/** `areas` — neighbourhoods inside the launch locality (0019). */
export type Area = {
  id: string;
  locality_id: string;
  slug: string;
  name: string;
  created_at: string;
};

export type Profile = {
  id: string;
  phone: string | null;
  /** 0026 — optional delivery address. Phone is still the identity bar. */
  email: string | null;
  full_name: string | null;
  role: UserRole | null;
  onboarding_step: OnboardingStep;
  active_locality_id: string | null;
  is_suspended: boolean;
  created_at: string;
  updated_at: string;
};

export type TenantIntent = {
  id: string;
  tenant_id: string;
  locality_id: string;
  /** Null means "anywhere in the locality". */
  area_id: string | null;
  budget_min: number;
  budget_max: number;
  bhk: BhkType;
  move_in_date: string;
  furnishing: FurnishingType;
  occupancy: OccupancyType;
  notes: string | null;
  status: IntentStatus;
  created_at: string;
  updated_at: string;
};

/** `properties` — the raw table (poster/admin scope). */
export type Property = {
  id: string;
  posted_by: string;
  locality_id: string;
  /** Null means the area was never set — legitimate for pre-0019 rows. */
  area_id: string | null;
  title: string;
  description: string | null;
  address_line: string | null;
  bhk: BhkType;
  furnishing: FurnishingType;
  occupancy_pref: OccupancyType;
  rent: number;
  deposit: number;
  maintenance_monthly: number;
  brokerage: number;
  /** 0023 — false means that 0 is an unset default, never a stated "no fee". */
  brokerage_disclosed: boolean;
  one_time_charges: number;
  available_from: string;
  availability: AvailabilityStatus;
  status: ListingStatus;
  last_verified_at: string | null;
  last_verified_by: string | null;
  created_at: string;
  updated_at: string;
};

/**
 * `v_listings_public` — the tenant-facing read model. Only `live` listings,
 * with cost totals, freshness and mismatch warnings computed in SQL so they
 * are always current (see supabase/migrations/0002 + 0003).
 */
export type ListingPublic = {
  id: string;
  locality_id: string;
  locality_slug: string;
  area_id: string | null;
  area_slug: string | null;
  area_name: string | null;
  title: string;
  description: string | null;
  address_line: string | null;
  bhk: BhkType;
  furnishing: FurnishingType;
  occupancy_pref: OccupancyType;
  rent: number;
  deposit: number;
  maintenance_monthly: number;
  brokerage: number;
  /** 0023 — false means that 0 is an unset default, never a stated "no fee". */
  brokerage_disclosed: boolean;
  one_time_charges: number;
  all_in_monthly: number;
  move_in_cost: number;
  available_from: string;
  availability: AvailabilityStatus;
  last_verified_at: string | null;
  /** True when the poster stamped it themselves rather than an admin (0009). */
  verified_by_poster: boolean;
  days_since_verified: number | null;
  is_stale: boolean;
  posted_by_role: UserRole | null;
  posted_by_name: string | null;
  posted_by: string;
  open_mismatch_count: number;
  has_warning: boolean;
  cover_photo_path: string | null;
  cover_photo_captured_at: string | null;
  photo_count: number;
  /** Slots this configuration owes, and how many are filled (0008). */
  rooms_required: number;
  rooms_covered: number;
  created_at: string;
};

/** `property_updates` — append-only audit log, written by the 0003 trigger. */
export type PropertyUpdate = {
  id: string;
  property_id: string;
  changed_by: string | null;
  field: string;
  old_value: string | null;
  new_value: string | null;
  kind: UpdateKind;
  created_at: string;
};

export type MismatchReport = {
  id: string;
  property_id: string;
  reported_by: string;
  type: MismatchType;
  description: string | null;
  status: ReportStatus;
  resolved_by: string | null;
  resolved_at: string | null;
  /** The poster's side of it (0017). Only they may write this. */
  owner_response: string | null;
  owner_responded_at: string | null;
  created_at: string;
};

export type BrokerSuggestion = {
  id: string;
  broker_id: string;
  tenant_intent_id: string;
  property_id: string;
  message: string | null;
  status: SuggestionStatus;
  responded_at: string | null;
  created_at: string;
  updated_at: string;
};

/**
 * `property_photos` — a photo carries its own capture date, separate from the
 * listing's verification, so a stale image can't ride on a fresh stamp.
 */
export type PropertyPhoto = {
  id: string;
  property_id: string;
  storage_path: string;
  caption: string | null;
  sort_order: number;
  captured_at: string | null;
  /** Which room this photo claims. One photo per slot — see 0008. */
  room_type: RoomType;
  /** Distinguishes Bedroom 1 from Bedroom 2; always 1 for single rooms. */
  room_index: number;
  created_by: string;
  created_at: string;
};

/** `moderation_actions` — who did what, as an admin, and when. */
export type ModerationAction = {
  id: string;
  admin_id: string;
  target_table: string;
  target_id: string;
  kind: ModerationKind;
  note: string | null;
  created_at: string;
};

/**
 * `contact_exchanges` — the moment a tenant and a poster can actually reach
 * each other. Append-only by design (no update policy in 0010): an exchange is
 * a thing that happened, and it's what unlocks the two profiles for each other.
 */
export type ContactExchange = {
  id: string;
  property_id: string;
  tenant_id: string;
  counterparty_id: string;
  source: ContactSource;
  message: string | null;
  created_at: string;
};

/**
 * `visit_feedback` — what actually happened after contact was exchanged (0015).
 * The answer to "did you go, and was it as described?", which is what turns
 * "verified" from asserted into measured.
 */
export type VisitFeedback = {
  id: string;
  contact_exchange_id: string;
  property_id: string;
  tenant_id: string;
  outcome: VisitOutcome;
  note: string | null;
  created_at: string;
  updated_at: string;
};

/** `v_listing_accuracy` — visit outcomes tallied per listing. */
export type ListingAccuracy = {
  property_id: string;
  answered: number;
  matched: number;
  mismatched: number;
  unreachable: number;
  did_not_visit: number;
};

/** `v_listing_price_context` — how this listing's cost sits against comparable
 * live listings. `sample` counts OTHER listings, never this one (0016). */
export type PriceContext = {
  property_id: string;
  all_in_monthly: number;
  sample: number;
  median_all_in: number | null;
  pct_vs_median: number | null;
};

/** `v_listing_engagement` — counts only, never who (0017). */
export type ListingEngagement = {
  property_id: string;
  posted_by: string;
  saves: number;
  enquiries: number;
  visits_answered: number;
};

/** `shortlists` — a private "come back to this", per person per listing (0011). */
export type Shortlist = {
  id: string;
  user_id: string;
  property_id: string;
  created_at: string;
};

/**
 * `notifications` — written only by the 0012 triggers, never by the app. `body`
 * is composed at insert time so what a notice said can't change later because
 * the underlying row did.
 */
export type Notification = {
  id: string;
  user_id: string;
  kind: NotificationKind;
  /** 0026 — when this went out by email. Null means still queued. */
  emailed_at: string | null;
  body: string;
  property_id: string | null;
  read_at: string | null;
  created_at: string;
};

/** `visits` — an arranged viewing (0020). The exchange is what gives standing. */
export type Visit = {
  id: string;
  property_id: string;
  tenant_id: string;
  host_id: string;
  contact_exchange_id: string;
  scheduled_for: string;
  status: VisitStatus;
  proposed_by: string;
  note: string | null;
  /** 0025 — when the day-before reminder went out. Null means unsent. */
  reminded_at: string | null;
  created_at: string;
  updated_at: string;
};

/** `v_possible_duplicates` — candidate pairs for a human to judge (0021). */
export type DuplicateCandidate = {
  property_id: string;
  other_id: string;
  title: string;
  other_title: string;
  posted_by: string;
  other_posted_by: string;
  all_in_monthly: number;
  other_all_in_monthly: number;
  area_name: string | null;
  address_similarity: number;
  different_posters: boolean;
};

/** `v_locality_health` — the MVP5 operator dashboard, computed in SQL. */
export type LocalityHealth = {
  locality_id: string;
  slug: string;
  name: string;
  live_count: number;
  stale_count: number;
  pending_count: number;
  available_count: number;
  open_mismatch_count: number;
  active_tenant_count: number;
};

type TableDef<Row, Ins = Partial<Row>, Upd = Partial<Row>> = {
  Row: Row;
  Insert: Ins;
  Update: Upd;
  Relationships: [];
};

export interface Database {
  public: {
    Tables: {
      localities: TableDef<Locality>;
      areas: TableDef<Area>;
      profiles: TableDef<Profile>;
      tenant_intents: TableDef<
        TenantIntent,
        Partial<Omit<TenantIntent, "id" | "created_at" | "updated_at">> &
          Pick<TenantIntent, "tenant_id" | "locality_id" | "budget_min" | "budget_max" | "bhk" | "move_in_date">
      >;
      properties: TableDef<
        Property,
        Partial<Omit<Property, "id" | "created_at" | "updated_at">> &
          Pick<Property, "posted_by" | "locality_id" | "title" | "bhk" | "rent" | "available_from">
      >;
      property_updates: TableDef<
        PropertyUpdate,
        Partial<Omit<PropertyUpdate, "id" | "created_at">> &
          Pick<PropertyUpdate, "property_id" | "field">
      >;
      mismatch_reports: TableDef<
        MismatchReport,
        Partial<Omit<MismatchReport, "id" | "created_at">> &
          Pick<MismatchReport, "property_id" | "reported_by" | "type">
      >;
      broker_suggestions: TableDef<
        BrokerSuggestion,
        Partial<Omit<BrokerSuggestion, "id" | "created_at" | "updated_at">> &
          Pick<BrokerSuggestion, "broker_id" | "tenant_intent_id" | "property_id">
      >;
      property_photos: TableDef<
        PropertyPhoto,
        Partial<Omit<PropertyPhoto, "id" | "created_at">> &
          Pick<PropertyPhoto, "property_id" | "storage_path" | "created_by">
      >;
      moderation_actions: TableDef<
        ModerationAction,
        Partial<Omit<ModerationAction, "id" | "created_at">> &
          Pick<ModerationAction, "admin_id" | "target_table" | "target_id" | "kind">
      >;
      notifications: TableDef<
        Notification,
        Partial<Omit<Notification, "id" | "created_at">> &
          Pick<Notification, "user_id" | "kind" | "body">
      >;
      visits: TableDef<
        Visit,
        Partial<Omit<Visit, "id" | "created_at" | "updated_at">> &
          Pick<Visit, "property_id" | "tenant_id" | "host_id" | "contact_exchange_id" | "scheduled_for" | "proposed_by">
      >;
      visit_feedback: TableDef<
        VisitFeedback,
        Partial<Omit<VisitFeedback, "id" | "created_at" | "updated_at">> &
          Pick<VisitFeedback, "contact_exchange_id" | "property_id" | "tenant_id" | "outcome">
      >;
      shortlists: TableDef<
        Shortlist,
        Partial<Omit<Shortlist, "id" | "created_at">> & Pick<Shortlist, "user_id" | "property_id">
      >;
      contact_exchanges: TableDef<
        ContactExchange,
        Partial<Omit<ContactExchange, "id" | "created_at">> &
          Pick<ContactExchange, "property_id" | "tenant_id" | "counterparty_id">
      >;
    };
    Views: {
      v_listings_public: { Row: ListingPublic; Relationships: [] };
      v_locality_health: { Row: LocalityHealth; Relationships: [] };
      v_listing_accuracy: { Row: ListingAccuracy; Relationships: [] };
      v_listing_price_context: { Row: PriceContext; Relationships: [] };
      v_listing_engagement: { Row: ListingEngagement; Relationships: [] };
      v_possible_duplicates: { Row: DuplicateCandidate; Relationships: [] };
    };
    Functions: {
      [key: string]: { Args: Record<string, unknown>; Returns: unknown };
    };
    Enums: {
      user_role: UserRole;
      onboarding_step: OnboardingStep;
      bhk_type: BhkType;
      furnishing_type: FurnishingType;
      occupancy_type: OccupancyType;
      intent_status: IntentStatus;
      availability_status: AvailabilityStatus;
      listing_status: ListingStatus;
      update_kind: UpdateKind;
      mismatch_type: MismatchType;
      report_status: ReportStatus;
      suggestion_status: SuggestionStatus;
      contact_source: ContactSource;
      notification_kind: NotificationKind;
      visit_outcome: VisitOutcome;
      visit_status: VisitStatus;
      moderation_kind: ModerationKind;
      room_type: RoomType;
    };
    CompositeTypes: Record<string, never>;
  };
}
