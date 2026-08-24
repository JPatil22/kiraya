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
export type NotificationKind =
  | "contact_received"
  | "suggestion_received"
  | "suggestion_answered"
  | "saved_listing_changed"
  | "mismatch_reported"
  | "listing_reviewed";
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

export type Profile = {
  id: string;
  phone: string | null;
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
  body: string;
  property_id: string | null;
  read_at: string | null;
  created_at: string;
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
      moderation_kind: ModerationKind;
      room_type: RoomType;
    };
    CompositeTypes: Record<string, never>;
  };
}
