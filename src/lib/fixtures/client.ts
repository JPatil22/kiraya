import type { SupabaseClient } from "@supabase/supabase-js";
import { MAX_PHOTOS } from "@/lib/photos";
import type {
  BrokerSuggestion,
  ContactExchange,
  Database,
  Shortlist,
  MismatchReport,
  ModerationAction,
  Property,
  PropertyPhoto,
  PropertyUpdate,
  TenantIntent,
  Visit,
  VisitFeedback,
} from "@/types/database";
import {
  AREAS,
  LOCALITY,
  addContact,
  addShortlist,
  addViewing,
  addVisit,
  addIntent,
  addMismatch,
  addModeration,
  addPhoto,
  addProperty,
  addSuggestion,
  addUpdate,
  getContacts,
  getIntents,
  getMismatches,
  getModerations,
  getNotifications,
  getPhotos,
  getProfiles,
  getProperties,
  getShortlists,
  getSuggestions,
  getViewings,
  getVisits,
  getUpdates,
  listingAccuracy,
  listingEngagement,
  listingPriceContext,
  listingsPublic,
  localityHealth,
  possibleDuplicates,
} from "./data";

/**
 * A hand-rolled stand-in for the supabase-js query builder — just enough of the
 * PostgREST surface for the shapes this app actually issues (select / eq / gte
 * / lte / order / limit / maybeSingle / single / insert).
 *
 * It exists so the UI can be walked through with no database at all. It is NOT
 * a Postgres emulator: no RLS, no triggers, no constraints. See ./data.ts.
 */

type Row = Record<string, unknown>;
/** Mirrors supabase-js: constraint failures come back as data, never as throws. */
type QueryError = { code: string; message: string };
/** PostgREST also returns `count` when the caller asks for it. */
type Result<T> = { data: T | null; error: QueryError | null; count?: number | null };

const ok = <T>(data: T, count?: number | null): Result<T> => ({ data, error: null, count });

class FixtureQuery<T extends Row> implements PromiseLike<Result<T[]>> {
  /** Filters accumulated so far, replayed by `update()` against the live store. */
  private predicates: ((row: Row) => boolean)[] = [];
  private wantsCount = false;
  private total: number | null = null;
  private patch: Row | null = null;
  private removing = false;
  private failure: QueryError | null = null;

  constructor(
    private rows: T[],
    private readonly onInsert?: (row: Row) => Row,
    private readonly backing?: () => Row[],
    /** Stands in for this table's UPDATE triggers; `before` is the pre-patch row. */
    private readonly onUpdate?: (row: Row, before: Row) => void,
  ) {}

  /**
   * `select("*", { count: "exact" })` — the count is taken AFTER filters but
   * BEFORE range/limit, which is what PostgREST does and what pagination needs:
   * "showing 1-20 of 47" is meaningless if the total is the page size.
   */
  select(_columns?: string, options?: { count?: "exact" | "planned" | "estimated" }): this {
    if (options?.count) this.wantsCount = true;
    return this;
  }

  range(from: number, to: number): this {
    if (this.wantsCount) this.total = this.rows.length;
    this.rows = this.rows.slice(from, to + 1);
    return this;
  }

  eq(column: string, value: unknown): this {
    this.predicates.push((r) => r[column] === value);
    this.rows = this.rows.filter((r) => r[column] === value);
    return this;
  }

  /**
   * Minimal stand-in for PostgREST's `or()`. Understands only the shape the app
   * actually builds — `col.ilike.*term*` joined by commas — and throws on
   * anything else rather than quietly matching everything, which is the failure
   * mode that would make fixture mode disagree with Postgres.
   */
  or(filters: string): this {
    const clauses = filters.split(",").map((clause) => {
      const match = /^([a-z_]+)\.ilike\.\*(.*)\*$/.exec(clause);
      if (!match) throw new Error(`Fixture client: unsupported or() clause "${clause}"`);
      const [, column, term] = match;
      const needle = term.toLowerCase();
      return (r: Row) => String(r[column] ?? "").toLowerCase().includes(needle);
    });

    const anyMatch = (r: Row) => clauses.some((c) => c(r));
    this.predicates.push(anyMatch);
    this.rows = this.rows.filter(anyMatch);
    return this;
  }

  /** Needed by the occupancy filter, which matches a value OR "any". */
  in(column: string, values: readonly unknown[]): this {
    this.predicates.push((r) => values.includes(r[column]));
    this.rows = this.rows.filter((r) => values.includes(r[column]));
    return this;
  }

  /** Only the null form is used (`is("read_at", null)`), so only that is honoured. */
  is(column: string, value: null | boolean): this {
    const test = (r: Row) => (value === null ? r[column] == null : r[column] === value);
    this.predicates.push(test);
    this.rows = this.rows.filter(test);
    return this;
  }

  neq(column: string, value: unknown): this {
    this.predicates.push((r) => r[column] !== value);
    this.rows = this.rows.filter((r) => r[column] !== value);
    return this;
  }

  gte(column: string, value: number): this {
    this.rows = this.rows.filter((r) => Number(r[column]) >= value);
    return this;
  }

  lte(column: string, value: number): this {
    this.rows = this.rows.filter((r) => Number(r[column]) <= value);
    return this;
  }

  /** Mirrors PostgREST: `nullsFirst` decides where NULLs land, not the direction. */
  order(
    column: string,
    { ascending = true, nullsFirst = false }: { ascending?: boolean; nullsFirst?: boolean } = {},
  ): this {
    this.rows = [...this.rows].sort((a, b) => {
      const x = a[column];
      const y = b[column];
      const xNull = x === null || x === undefined;
      const yNull = y === null || y === undefined;

      if (xNull && yNull) return 0;
      if (xNull) return nullsFirst ? -1 : 1;
      if (yNull) return nullsFirst ? 1 : -1;
      if (x === y) return 0;

      const less = typeof x === "number" && typeof y === "number" ? x < y : String(x) < String(y);
      return (less ? -1 : 1) * (ascending ? 1 : -1);
    });
    return this;
  }

  limit(n: number): this {
    if (this.wantsCount && this.total === null) this.total = this.rows.length;
    this.rows = this.rows.slice(0, n);
    return this;
  }

  async maybeSingle(): Promise<Result<T | null>> {
    this.applyUpdate();
    if (this.failure) return { data: null, error: this.failure };
    return ok(this.rows[0] ?? null);
  }

  async single(): Promise<Result<T | null>> {
    return this.maybeSingle();
  }

  insert(values: Row | Row[]): FixtureQuery<T> {
    const list = Array.isArray(values) ? values : [values];
    if (!this.onInsert) {
      throw new Error(
        "Fixture client: this table has no insert handler. Add one in src/lib/fixtures/client.ts.",
      );
    }

    const next = new FixtureQuery<T>([]);
    try {
      next.rows = list.map(this.onInsert) as T[];
    } catch (e) {
      // Seed constraints (the unique indexes) surface the way PostgREST would.
      const err = e as Error & { code?: string };
      next.failure = { code: err.code ?? "23000", message: err.message };
    }
    return next;
  }

  /** Staged like `update()`; removes every row matching the filters. */
  delete(): this {
    if (!this.backing) {
      throw new Error(
        "Fixture client: this table is read-only. Add a backing store in src/lib/fixtures/client.ts.",
      );
    }
    this.removing = true;
    return this;
  }

  /**
   * Staged until the query is awaited, so `.update(x).eq("id", y)` reads the
   * same way it does against PostgREST. Writes through to the live store.
   */
  update(values: Row): this {
    if (!this.backing) {
      throw new Error(
        "Fixture client: this table is read-only. Add a backing store in src/lib/fixtures/client.ts.",
      );
    }
    this.patch = values;
    return this;
  }

  private applyUpdate(): void {
    if (!this.backing) return;

    if (this.removing) {
      const store = this.backing();
      for (let i = store.length - 1; i >= 0; i -= 1) {
        if (this.predicates.every((p) => p(store[i]))) store.splice(i, 1);
      }
      this.removing = false;
    }

    if (!this.patch) return;
    for (const row of this.backing()) {
      if (!this.predicates.every((p) => p(row))) continue;
      const before = { ...row };
      Object.assign(row, this.patch);
      this.onUpdate?.(row, before);
    }
    this.patch = null;
  }

  then<R1 = Result<T[]>, R2 = never>(
    onfulfilled?: ((value: Result<T[]>) => R1 | PromiseLike<R1>) | null,
    onrejected?: ((reason: unknown) => R2 | PromiseLike<R2>) | null,
  ): PromiseLike<R1 | R2> {
    this.applyUpdate();
    const result: Result<T[]> = this.failure
      ? { data: null, error: this.failure }
      : ok(this.rows, this.wantsCount ? (this.total ?? this.rows.length) : undefined);
    return Promise.resolve(result).then(onfulfilled, onrejected);
  }
}

const iso = () => new Date().toISOString();

/** Fill in the defaults Postgres would have supplied. */
function insertProperty(row: Row): Row {
  const created = {
    id: `prop-${Math.random().toString(36).slice(2, 10)}`,
    locality_id: LOCALITY.id,
    description: null,
    address_line: null,
    deposit: 0,
    maintenance_monthly: 0,
    brokerage: 0,
    one_time_charges: 0,
    availability: "available",
    status: "draft",
    last_verified_at: null,
    last_verified_by: null,
    created_at: iso(),
    updated_at: iso(),
    ...row,
  } as Property;

  addProperty(created);
  return created as unknown as Row;
}

function insertIntent(row: Row): Row {
  const created = {
    id: `int-${Math.random().toString(36).slice(2, 10)}`,
    locality_id: LOCALITY.id,
    notes: null,
    status: "active",
    created_at: iso(),
    updated_at: iso(),
    ...row,
  } as TenantIntent;

  addIntent(created);
  return created as unknown as Row;
}

function insertMismatch(row: Row): Row {
  // Stands in for the partial unique index in 0003: one open report per person.
  const duplicate = getMismatches().some(
    (m) =>
      m.property_id === row.property_id &&
      m.reported_by === row.reported_by &&
      m.status === "open",
  );
  if (duplicate) {
    const err = new Error("duplicate key value violates unique constraint");
    (err as Error & { code: string }).code = "23505";
    throw err;
  }

  const created = {
    id: `mis-${Math.random().toString(36).slice(2, 10)}`,
    description: null,
    status: "open",
    resolved_by: null,
    resolved_at: null,
    created_at: iso(),
    ...row,
  } as MismatchReport;

  addMismatch(created);
  return created as unknown as Row;
}

function insertPhoto(row: Row): Row {
  const forProperty = getPhotos().filter((p) => p.property_id === row.property_id);

  // Stands in for the 8-photo cap enforced by the trigger in 0006.
  if (forProperty.length >= MAX_PHOTOS) {
    const err = new Error(`A listing can have at most ${MAX_PHOTOS} photos`);
    (err as Error & { code: string }).code = "23514";
    throw err;
  }

  // Stands in for `property_photos_one_per_room` in 0008 — the rule that stops
  // a listing padding itself with eight angles of the same living room.
  const slotTaken = forProperty.some(
    (p) => p.room_type === row.room_type && p.room_index === (row.room_index ?? 1),
  );
  if (slotTaken) {
    const err = new Error(
      'duplicate key value violates unique constraint "property_photos_one_per_room"',
    );
    (err as Error & { code: string }).code = "23505";
    throw err;
  }

  const created = {
    id: `pho-${Math.random().toString(36).slice(2, 10)}`,
    caption: null,
    sort_order: forProperty.length,
    captured_at: null,
    room_index: 1,
    created_at: iso(),
    ...row,
  } as PropertyPhoto;

  addPhoto(created);
  return created as unknown as Row;
}

function insertContact(row: Row): Row {
  // Stands in for unique (tenant_id, property_id, counterparty_id) in 0010.
  const duplicate = getContacts().some(
    (c) =>
      c.tenant_id === row.tenant_id &&
      c.property_id === row.property_id &&
      c.counterparty_id === row.counterparty_id,
  );
  if (duplicate) {
    throw Object.assign(new Error("duplicate key value violates unique constraint"), {
      code: "23505",
    });
  }

  const created = {
    id: `ce-${Math.random().toString(36).slice(2, 10)}`,
    source: "listing",
    message: null,
    created_at: iso(),
    ...row,
  } as ContactExchange;

  addContact(created);
  return created as unknown as Row;
}

function insertViewing(row: Row): Row {
  const created = {
    id: `vs-${Math.random().toString(36).slice(2, 10)}`,
    status: "proposed",
    note: null,
    created_at: iso(),
    updated_at: iso(),
    ...row,
  } as Visit;

  addViewing(created);
  return created as unknown as Row;
}

function insertVisit(row: Row): Row {
  const created = {
    id: `vf-${Math.random().toString(36).slice(2, 10)}`,
    note: null,
    created_at: iso(),
    updated_at: iso(),
    ...row,
  } as VisitFeedback;

  addVisit(created);
  return created as unknown as Row;
}

function insertShortlist(row: Row): Row {
  // Stands in for unique (user_id, property_id) in 0011.
  const duplicate = getShortlists().some(
    (x) => x.user_id === row.user_id && x.property_id === row.property_id,
  );
  if (duplicate) {
    throw Object.assign(new Error("duplicate key value violates unique constraint"), {
      code: "23505",
    });
  }

  const created = {
    id: `sl-${Math.random().toString(36).slice(2, 10)}`,
    created_at: iso(),
    ...row,
  } as Shortlist;

  addShortlist(created);
  return created as unknown as Row;
}

function insertModeration(row: Row): Row {
  const created = {
    id: `mod-${Math.random().toString(36).slice(2, 10)}`,
    note: null,
    created_at: iso(),
    ...row,
  } as ModerationAction;

  addModeration(created);
  return created as unknown as Row;
}

function insertSuggestion(row: Row): Row {
  // Stands in for unique (tenant_intent_id, property_id) in 0004.
  const duplicate = getSuggestions().some(
    (s) =>
      s.tenant_intent_id === row.tenant_intent_id && s.property_id === row.property_id,
  );
  if (duplicate) {
    const err = new Error("duplicate key value violates unique constraint");
    (err as Error & { code: string }).code = "23505";
    throw err;
  }

  const created = {
    id: `sug-${Math.random().toString(36).slice(2, 10)}`,
    message: null,
    status: "sent",
    responded_at: null,
    created_at: iso(),
    updated_at: iso(),
    ...row,
  } as BrokerSuggestion;

  addSuggestion(created);
  return created as unknown as Row;
}

/**
 * Stands in for the `log_property_changes` trigger in migration 0003 — the
 * append-only audit log the MVP3 timeline reads. Same column list, same `kind`
 * mapping as the SQL.
 */
const LOGGED_FIELDS: [field: string, kind: PropertyUpdate["kind"]][] = [
  ["rent", "price"],
  ["deposit", "price"],
  ["maintenance_monthly", "price"],
  ["brokerage", "price"],
  ["one_time_charges", "price"],
  ["availability", "availability"],
  ["available_from", "availability"],
  ["furnishing", "terms"],
  ["occupancy_pref", "terms"],
  ["last_verified_at", "verification"],
  ["status", "other"],
];

function logPropertyChanges(row: Row, before: Row): void {
  for (const [field, kind] of LOGGED_FIELDS) {
    if (row[field] === before[field]) continue;

    addUpdate({
      id: `upd-${Math.random().toString(36).slice(2, 10)}`,
      property_id: String(row.id),
      // The real trigger records auth.uid(); the sandbox has no session, so
      // attribute to whoever last stamped verification, else the poster.
      changed_by: String(row.last_verified_by ?? row.posted_by),
      field,
      old_value: before[field] === null ? null : String(before[field]),
      new_value: row[field] === null ? null : String(row[field]),
      kind,
      created_at: iso(),
    });
  }
}

/** Stands in for the `stamp_suggestion_response` trigger in migration 0004. */
const RESPONDED: ReadonlySet<string> = new Set([
  "viewed",
  "accepted",
  "declined",
  "not_relevant",
]);

function stampSuggestionResponse(row: Row): void {
  if (RESPONDED.has(String(row.status)) && !row.responded_at) {
    row.responded_at = iso();
    row.updated_at = iso();
  }
}

/**
 * Cast at the boundary: this deliberately implements only the slice of
 * `SupabaseClient` the app touches, so the structural type can't line up.
 * Everything downstream stays fully typed against `Database`.
 */
export function createFixtureClient(): SupabaseClient<Database> {
  const client = {
    from(table: string) {
      switch (table) {
        case "localities":
          return new FixtureQuery([{ ...LOCALITY }]);
        case "areas":
          return new FixtureQuery(AREAS.map((a) => ({ ...a })));
        case "profiles":
          return new FixtureQuery(
            getProfiles().map((p) => ({ ...p })),
            undefined,
            getProfiles as () => Row[],
          );
        case "properties":
          return new FixtureQuery(
            getProperties().map((p) => ({ ...p })),
            insertProperty,
            getProperties as () => Row[],
            logPropertyChanges,
          );
        case "tenant_intents":
          return new FixtureQuery(
            getIntents().map((i) => ({ ...i })),
            insertIntent,
          );
        case "property_updates":
          // Append-only, and only the DB trigger appends — no insert handler.
          return new FixtureQuery(getUpdates().map((u) => ({ ...u })));
        case "mismatch_reports":
          return new FixtureQuery(
            getMismatches().map((m) => ({ ...m })),
            insertMismatch,
            getMismatches as () => Row[],
          );
        case "broker_suggestions":
          return new FixtureQuery(
            getSuggestions().map((s) => ({ ...s })),
            insertSuggestion,
            getSuggestions as () => Row[],
            stampSuggestionResponse,
          );
        case "property_photos":
          return new FixtureQuery(
            getPhotos().map((p) => ({ ...p })),
            insertPhoto,
            getPhotos as () => Row[],
          );
        case "visits":
          return new FixtureQuery(
            getViewings().map((v) => ({ ...v })),
            insertViewing,
            getViewings as () => Row[],
          );
        case "visit_feedback":
          return new FixtureQuery(
            getVisits().map((v) => ({ ...v })),
            insertVisit,
            getVisits as () => Row[],
          );
        case "notifications":
          return new FixtureQuery(
            getNotifications().map((n) => ({ ...n })),
            undefined,
            getNotifications as () => Row[],
          );
        case "shortlists":
          return new FixtureQuery(
            getShortlists().map((x) => ({ ...x })),
            insertShortlist,
            getShortlists as () => Row[],
          );
        case "contact_exchanges":
          return new FixtureQuery(
            getContacts().map((c) => ({ ...c })),
            insertContact,
          );
        case "moderation_actions":
          return new FixtureQuery(
            getModerations().map((m) => ({ ...m })),
            insertModeration,
          );
        case "v_listings_public":
          return new FixtureQuery(listingsPublic().map((l) => ({ ...l })));
        case "v_listing_engagement":
          return new FixtureQuery(listingEngagement().map((r) => ({ ...r })));
        case "v_listing_accuracy":
          return new FixtureQuery(listingAccuracy().map((r) => ({ ...r })));
        case "v_listing_price_context":
          return new FixtureQuery(listingPriceContext().map((r) => ({ ...r })));
        case "v_possible_duplicates":
          return new FixtureQuery(possibleDuplicates().map((r) => ({ ...r })));
        case "v_locality_health":
          return new FixtureQuery(localityHealth().map((h) => ({ ...h })));
        default:
          throw new Error(
            `Fixture client: no data for table "${table}". Add it in src/lib/fixtures/client.ts.`,
          );
      }
    },
    auth: {
      async getUser() {
        // No sessions in fixture mode — open mode supplies the identity.
        return { data: { user: null }, error: null };
      },
      async signOut() {
        return { error: null };
      },
    },
  };

  return client as unknown as SupabaseClient<Database>;
}
