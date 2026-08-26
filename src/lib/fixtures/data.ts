import { ACTIVE_LOCALITY_SLUG } from "@/lib/locality";
import { DEV_PHONES } from "@/lib/open-mode";
import { roomsRequiredForBhk } from "@/lib/rooms";
import type {
  BrokerSuggestion,
  ContactExchange,
  Area,
  Shortlist,
  ListingPublic,
  Locality,
  LocalityHealth,
  MismatchReport,
  ModerationAction,
  Notification,
  Profile,
  Property,
  PropertyPhoto,
  PropertyUpdate,
  TenantIntent,
  Visit,
  VisitFeedback,
} from "@/types/database";

/**
 * In-memory stand-in for the database, used when NEXT_PUBLIC_USE_FIXTURES=true.
 *
 * Mirrors what `npm run db:seed` writes, so a walkthrough here matches a
 * walkthrough against real Postgres. What it CANNOT show you is the half of
 * this product that lives in SQL: RLS, `properties_guard`, the
 * `log_property_changes` audit trigger, and the constraints. Those only get
 * exercised against a real database.
 */

/** Slots that count toward coverage — mirrors the filter in 0008's view. */
const REQUIRED_ROOM_TYPES = new Set<PropertyPhoto["room_type"]>([
  "hall",
  "kitchen",
  "bathroom",
  "bedroom",
]);

const now = Date.now();
const daysAgo = (n: number) => new Date(now - n * 86_400_000).toISOString();
const dateIn = (n: number) => new Date(now + n * 86_400_000).toISOString().slice(0, 10);

export const LOCALITY: Locality = {
  id: "loc-pune",
  slug: ACTIVE_LOCALITY_SLUG,
  name: "Pune",
  city: "Pune",
  state: "Maharashtra",
  verify_stale_days: 7,
  is_active: true,
  created_at: daysAgo(120),
};

function profile(
  id: string,
  phone: string,
  full_name: string,
  role: Profile["role"],
): Profile {
  return {
    id,
    phone,
    // Sandbox identities are reachable by email the same way the RLS harness
    // signs them in: <key>@kiraya.dev.
    email: `${id.replace(/^u-/, "")}@kiraya.dev`,
    full_name,
    role,
    onboarding_step: "done",
    active_locality_id: LOCALITY.id,
    is_suspended: false,
    created_at: daysAgo(60),
    updated_at: daysAgo(60),
  };
}

/** Mirrors the areas 0019 seeds. Slugs match so fixture URLs behave the same. */
export const AREAS: Area[] = (
  [
    ["aundh", "Aundh", 18.5590, 73.8078],
    ["balewadi", "Balewadi", 18.5750, 73.7690],
    ["baner", "Baner", 18.5590, 73.7770],
    ["hadapsar", "Hadapsar", 18.5089, 73.9260],
    ["hinjewadi", "Hinjewadi", 18.5910, 73.7380],
    ["kharadi", "Kharadi", 18.5515, 73.9436],
    ["koregaon-park", "Koregaon Park", 18.5362, 73.8939],
    ["kothrud", "Kothrud", 18.5074, 73.8077],
    ["magarpatta", "Magarpatta", 18.5157, 73.9280],
    ["pimple-saudagar", "Pimple Saudagar", 18.5980, 73.7900],
    ["viman-nagar", "Viman Nagar", 18.5679, 73.9143],
    ["wakad", "Wakad", 18.5987, 73.7614],
  ] as [string, string, number, number][]
).map(([slug, name, latitude, longitude]) => ({
  id: `area-${slug}`,
  locality_id: LOCALITY.id,
  slug,
  name,
  latitude,
  longitude,
  created_at: daysAgo(120),
}));

export const PROFILES: Profile[] = [
  profile("u-tenant", DEV_PHONES.tenant, "Ananya Rao", "tenant"),
  profile("u-owner", DEV_PHONES.owner, "Suresh Kamath", "owner"),
  profile("u-broker", DEV_PHONES.broker, "Imran Sheikh", "broker"),
  profile("u-admin", DEV_PHONES.admin, "Kiraya Ops", "admin"),
  profile("u-tenant2", "+919000000005", "Priya Nair", "tenant"),
];

const SEED_INTENTS: TenantIntent[] = [
  {
    id: "int-1",
    tenant_id: "u-tenant",
    locality_id: LOCALITY.id,
    // Named an area, so matching is exercised rather than trivially passing.
    area_id: "area-baner",
    budget_min: 20000,
    budget_max: 35000,
    bhk: "2bhk",
    move_in_date: dateIn(21),
    furnishing: "semi",
    occupancy: "family",
    notes: "Prefer a ground or first floor, and covered parking for one car.",
    status: "active",
    created_at: daysAgo(9),
    updated_at: daysAgo(9),
  },
];

/** Two open reports on prop-5 → `has_warning` flips, same as the SQL view. */
const SEED_MISMATCHES: MismatchReport[] = [
  {
    id: "mis-1",
    property_id: "prop-5",
    reported_by: "u-tenant",
    type: "price_higher",
    description: "Owner quoted ₹14,000 on the call, not ₹12,000.",
    status: "open",
    resolved_by: null,
    resolved_at: null,
    // One answered, one not — so the UI shows both states.
    owner_response: "The ₹14,000 quote included two months' maintenance up front. Rent is ₹12,000.",
    owner_responded_at: daysAgo(2),
    created_at: daysAgo(3),
  },
  {
    id: "mis-2",
    property_id: "prop-5",
    reported_by: "u-tenant2",
    type: "already_rented",
    description: "Was told it went last week.",
    status: "open",
    resolved_by: null,
    resolved_at: null,
    owner_response: null,
    owner_responded_at: null,
    created_at: daysAgo(1),
  },
];

/**
 * What the 0003 trigger would have logged. Mirrors the two changes the seed
 * script applies with real UPDATEs (rent 28,000 → 30,000; availability → on hold).
 */
const SEED_UPDATES: PropertyUpdate[] = [
  {
    id: "upd-1",
    property_id: "prop-1",
    changed_by: "u-owner",
    field: "rent",
    old_value: "28000",
    new_value: "30000",
    kind: "price",
    created_at: daysAgo(5),
  },
  {
    id: "upd-2",
    property_id: "prop-1",
    changed_by: "u-admin",
    field: "last_verified_at",
    old_value: null,
    new_value: new Date(now - 86_400_000).toISOString(),
    kind: "verification",
    created_at: daysAgo(1),
  },
  {
    id: "upd-3",
    property_id: "prop-2",
    changed_by: "u-broker",
    field: "availability",
    old_value: "available",
    new_value: "on_hold",
    kind: "availability",
    created_at: daysAgo(2),
  },
  {
    id: "upd-4",
    property_id: "prop-3",
    changed_by: "u-owner",
    field: "deposit",
    old_value: "120000",
    new_value: "100000",
    kind: "price",
    created_at: daysAgo(18),
  },
];

/**
 * Placeholder photos as inline SVG data URLs — no binary assets in the repo,
 * and it exercises the same code path a real upload uses in fixture mode.
 * Capture dates are chosen to demo both states: recent, and pointedly old.
 */
const swatch = (label: string, hue: number) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="500">
       <rect width="800" height="500" fill="hsl(${hue} 30% 82%)"/>
       <text x="400" y="260" font-family="system-ui,sans-serif" font-size="34"
             fill="hsl(${hue} 40% 30%)" text-anchor="middle">${label}</text>
     </svg>`.replace(/\s+/g, " "),
  )}`;

const recent = new Date(now - 20 * 86_400_000).toISOString().slice(0, 10);

function photo(
  id: string,
  property_id: string,
  room_type: PropertyPhoto["room_type"],
  room_index: number,
  label: string,
  hue: number,
  extra: Partial<PropertyPhoto> = {},
): PropertyPhoto {
  return {
    id,
    property_id,
    storage_path: swatch(label, hue),
    caption: label,
    sort_order: 0,
    captured_at: recent,
    room_type,
    room_index,
    created_by: "u-owner",
    created_at: daysAgo(20),
    ...extra,
  };
}

/**
 * Chosen to demo all three coverage states side by side in the feed:
 *   prop-1 (2BHK) → 3 of 5 rooms, the ordinary partial case
 *   prop-2 (3BHK) → 1 of 6, plus a pointedly ancient photo
 *   prop-3 (1BHK) → 4 of 4, fully covered
 */
const SEED_PHOTOS: PropertyPhoto[] = [
  photo("pho-1", "prop-1", "hall", 1, "Hall", 210),
  photo("pho-2", "prop-1", "kitchen", 1, "Kitchen", 150),
  photo("pho-3", "prop-1", "bedroom", 1, "Bedroom 1", 260),
  // Bedroom 2 and the bathroom are deliberately absent.

  photo("pho-4", "prop-2", "hall", 1, "Hall", 190, {
    created_by: "u-broker",
    created_at: daysAgo(11),
    // Two years old: the card and gallery should both call this out.
    captured_at: new Date(now - 700 * 86_400_000).toISOString().slice(0, 10),
  }),
  photo("pho-5", "prop-2", "balcony", 1, "Balcony", 30, {
    created_by: "u-broker",
    created_at: daysAgo(11),
    // No date given — the other honesty state.
    captured_at: null,
  }),

  photo("pho-6", "prop-3", "hall", 1, "Hall", 280),
  photo("pho-7", "prop-3", "kitchen", 1, "Kitchen", 120),
  photo("pho-8", "prop-3", "bedroom", 1, "Bedroom", 320),
  photo("pho-9", "prop-3", "bathroom", 1, "Bathroom", 20),
];

const SEED_NOTIFICATIONS: Notification[] = [
  {
    id: "ntf-1",
    user_id: "u-owner",
    kind: "contact_received",
    body: 'Ananya Rao asked for your number about "Bright 2BHK off Balewadi High Street"',
    property_id: "prop-1",
    read_at: null,
    emailed_at: null,
    created_at: daysAgo(1),
  },
  {
    id: "ntf-2",
    user_id: "u-tenant",
    kind: "suggestion_received",
    body: 'A broker suggested "Spacious 3BHK in Kharadi, near EON IT Park" for you',
    property_id: "prop-2",
    read_at: null,
    emailed_at: null,
    created_at: daysAgo(2),
  },
];

/** One broker suggestion already waiting in the tenant's inbox. */
const SEED_SUGGESTIONS: BrokerSuggestion[] = [
  {
    id: "sug-1",
    broker_id: "u-broker",
    tenant_intent_id: "int-1",
    property_id: "prop-2",
    message:
      "Slightly over your ceiling, but it's fully furnished and maintenance is included.",
    status: "sent",
    responded_at: null,
    created_at: daysAgo(2),
    updated_at: daysAgo(2),
  },
];

function property(p: Partial<Property> & Pick<Property, "id" | "posted_by" | "title">): Property {
  return {
    locality_id: LOCALITY.id,
    area_id: null,
    latitude: null,
    longitude: null,
    description: null,
    address_line: null,
    bhk: "2bhk",
    furnishing: "semi",
    occupancy_pref: "any",
    rent: 0,
    deposit: 0,
    maintenance_monthly: 0,
    brokerage: 0,
    brokerage_disclosed: true,
    one_time_charges: 0,
    available_from: dateIn(7),
    availability: "available",
    status: "live",
    last_verified_at: null,
    last_verified_by: null,
    created_at: daysAgo(20),
    updated_at: daysAgo(20),
    ...p,
  };
}

const SEED_PROPERTIES: Property[] = [
  property({
    id: "prop-1",
    posted_by: "u-owner",
    title: "Bright 2BHK off Balewadi High Street",
    description:
      "East-facing, corner unit on the 3rd floor. Covered parking for one car. Walk to Balewadi High Street.",
    address_line: "Balewadi, Baner",
    latitude: 18.5758,
    longitude: 73.7689,
    area_id: "area-balewadi",
    bhk: "2bhk",
    furnishing: "semi",
    occupancy_pref: "family",
    // 32,000 at listing time; the seeded price change took it to 34,000.
    rent: 30000,
    deposit: 200000,
    maintenance_monthly: 2500,
    brokerage: 0,
    brokerage_disclosed: true,
    one_time_charges: 5000,
    available_from: dateIn(10),
    last_verified_at: daysAgo(1),
    last_verified_by: "u-admin",
    created_at: daysAgo(14),
  }),
  property({
    id: "prop-2",
    posted_by: "u-broker",
    title: "Spacious 3BHK in Kharadi, near EON IT Park",
    description: "Two balconies, 24x7 water and backup. Society has a gym and lift.",
    address_line: "Nyati Estate Road, Kharadi",
    latitude: 18.5515,
    longitude: 73.9436,
    area_id: "area-kharadi",
    bhk: "3bhk",
    furnishing: "full",
    occupancy_pref: "any",
    rent: 45000,
    deposit: 300000,
    maintenance_monthly: 4000,
    brokerage: 48000,
    brokerage_disclosed: true,
    one_time_charges: 10000,
    available_from: dateIn(21),
    availability: "on_hold",
    last_verified_at: daysAgo(4),
    last_verified_by: "u-admin",
    created_at: daysAgo(11),
  }),
  property({
    id: "prop-3",
    posted_by: "u-owner",
    title: "Compact 1BHK on Paud Road, Kothrud",
    description: "Independent floor, separate entrance. Ideal for a couple or single tenant.",
    address_line: "Paud Road, Kothrud",
    latitude: 18.5074,
    longitude: 73.8077,
    area_id: "area-kothrud",
    bhk: "1bhk",
    furnishing: "unfurnished",
    occupancy_pref: "any",
    rent: 16000,
    deposit: 100000,
    maintenance_monthly: 1500,
    brokerage: 0,
    brokerage_disclosed: true,
    one_time_charges: 3000,
    available_from: dateIn(5),
    // Past the 7-day window → stale.
    last_verified_at: daysAgo(12),
    last_verified_by: "u-admin",
    created_at: daysAgo(30),
  }),
  property({
    id: "prop-4",
    posted_by: "u-broker",
    title: "Semi-furnished 2BHK in Wakad",
    description: "Wardrobes and modular kitchen included. Two-wheeler parking only.",
    address_line: "Datta Mandir Road, Wakad",
    latitude: 18.5987,
    longitude: 73.7614,
    area_id: "area-wakad",
    bhk: "2bhk",
    furnishing: "semi",
    occupancy_pref: "bachelors_male",
    rent: 24000,
    deposit: 180000,
    maintenance_monthly: 2000,
    brokerage: 29000,
    brokerage_disclosed: true,
    one_time_charges: 4000,
    available_from: dateIn(3),
    // Never verified → sinks to the bottom of the freshness sort.
    last_verified_at: null,
    created_at: daysAgo(6),
  }),
  property({
    id: "prop-5",
    posted_by: "u-owner",
    title: "1RK studio near Viman Nagar Phoenix",
    description: "Compact studio with attached bath. Water and maintenance included.",
    address_line: "Nagar Road, Viman Nagar",
    latitude: 18.5679,
    longitude: 73.9143,
    area_id: "area-viman-nagar",
    bhk: "1rk",
    furnishing: "semi",
    occupancy_pref: "bachelors_female",
    rent: 12000,
    deposit: 60000,
    maintenance_monthly: 1000,
    brokerage: 0,
    brokerage_disclosed: true,
    one_time_charges: 2000,
    available_from: dateIn(1),
    last_verified_at: daysAgo(2),
    last_verified_by: "u-admin",
    created_at: daysAgo(8),
  }),
  property({
    id: "prop-6",
    posted_by: "u-owner",
    title: "Premium 3BHK duplex in Koregaon Park",
    description:
      "Top-floor duplex with a private terrace. Available after the current tenant exits.",
    address_line: "Lane 6, Koregaon Park",
    latitude: 18.5362,
    longitude: 73.8939,
    area_id: "area-koregaon-park",
    bhk: "3bhk",
    furnishing: "full",
    occupancy_pref: "family",
    rent: 75000,
    deposit: 400000,
    maintenance_monthly: 5000,
    brokerage: 0,
    brokerage_disclosed: true,
    one_time_charges: 12000,
    available_from: dateIn(30),
    // Not public — shows as "In review" on the poster's dashboard.
    status: "pending_review",
    created_at: daysAgo(2),
  }),
];

/**
 * Mutable store, hung off `globalThis` on purpose.
 *
 * Next.js instantiates the same module separately in the RSC and Server Action
 * layers, so a plain module-level array is NOT shared between a page render and
 * the action that writes to it — a posted listing would vanish. One global
 * keeps both halves looking at the same data. Resets on dev-server restart.
 */
type FixtureStore = {
  properties: Property[];
  intents: TenantIntent[];
  mismatches: MismatchReport[];
  updates: PropertyUpdate[];
  suggestions: BrokerSuggestion[];
  moderations: ModerationAction[];
  profiles: Profile[];
  photos: PropertyPhoto[];
  contacts: ContactExchange[];
  shortlists: Shortlist[];
  notifications: Notification[];
  visits: VisitFeedback[];
  viewings: Visit[];
};

const globalRef = globalThis as unknown as { __kirayaFixtures?: FixtureStore };

const seedStore = (): FixtureStore => ({
  properties: [...SEED_PROPERTIES],
  intents: [...SEED_INTENTS],
  mismatches: [...SEED_MISMATCHES],
  updates: [...SEED_UPDATES],
  suggestions: [...SEED_SUGGESTIONS],
  moderations: [],
  // Copied so admin suspend/reinstate can mutate them.
  profiles: PROFILES.map((p) => ({ ...p })),
  photos: [...SEED_PHOTOS],
  // Starts empty on purpose: an exchange is something a person does, and the
  // sandbox should show the "not yet unlocked" state first.
  contacts: [],
  shortlists: [],
  // Fixtures cannot run the 0012 triggers — same limitation as RLS and the
  // audit trigger — so two are seeded purely so the screens have something to
  // render. Against real Postgres these arrive on their own.
  notifications: [...SEED_NOTIFICATIONS],
  visits: [],
  viewings: [],
});

function store(): FixtureStore {
  const current = globalRef.__kirayaFixtures;

  // A hot reload that adds a collection leaves the surviving global a key
  // short, which would hand back `undefined` instead of an array. Rebuild
  // rather than limp along — this only ever costs unsaved sandbox writes.
  if (current && Object.keys(seedStore()).every((k) => k in current)) return current;

  globalRef.__kirayaFixtures = seedStore();
  return globalRef.__kirayaFixtures;
}

export const getProperties = (): Property[] => store().properties;
export const getIntents = (): TenantIntent[] => store().intents;
export const getMismatches = (): MismatchReport[] => store().mismatches;
export const getUpdates = (): PropertyUpdate[] => store().updates;
export const getSuggestions = (): BrokerSuggestion[] => store().suggestions;
export const getModerations = (): ModerationAction[] => store().moderations;
export const getProfiles = (): Profile[] => store().profiles;
export const getPhotos = (): PropertyPhoto[] => store().photos;
export const getContacts = (): ContactExchange[] => store().contacts;
export const getShortlists = (): Shortlist[] => store().shortlists;
export const getNotifications = (): Notification[] => store().notifications;
export const getVisits = (): VisitFeedback[] => store().visits;
export const getViewings = (): Visit[] => store().viewings;

export function addPhoto(row: PropertyPhoto): void {
  store().photos.push(row);
}

export function addContact(row: ContactExchange): void {
  store().contacts.unshift(row);
}

export function addShortlist(row: Shortlist): void {
  store().shortlists.unshift(row);
}

export function addVisit(row: VisitFeedback): void {
  store().visits.unshift(row);
}

export function addViewing(row: Visit): void {
  store().viewings.unshift(row);
}

export function addModeration(row: ModerationAction): void {
  store().moderations.unshift(row);
}

export function addUpdate(row: PropertyUpdate): void {
  store().updates.unshift(row);
}

export function addProperty(row: Property): void {
  store().properties.unshift(row);
}

export function addIntent(row: TenantIntent): void {
  store().intents.unshift(row);
}

export function addMismatch(row: MismatchReport): void {
  store().mismatches.unshift(row);
}

export function addSuggestion(row: BrokerSuggestion): void {
  store().suggestions.unshift(row);
}

/** The `v_locality_health` projection from migration 0005. */
export function localityHealth(): LocalityHealth[] {
  const props = getProperties();
  const live = props.filter((p) => p.status === "live");
  const isStale = (p: Property) =>
    p.last_verified_at === null ||
    Date.parse(p.last_verified_at) < Date.now() - LOCALITY.verify_stale_days * 86_400_000;

  return [
    {
      locality_id: LOCALITY.id,
      slug: LOCALITY.slug,
      name: LOCALITY.name,
      live_count: live.length,
      stale_count: live.filter(isStale).length,
      pending_count: props.filter((p) => p.status === "pending_review").length,
      available_count: live.filter((p) => p.availability === "available").length,
      open_mismatch_count: getMismatches().filter((m) => m.status === "open").length,
      active_tenant_count: new Set(
        getIntents().filter((i) => i.status === "active").map((i) => i.tenant_id),
      ).size,
    },
  ];
}

/**
 * The `v_listings_public` projection, computed in TS instead of SQL. Kept
 * deliberately close to migration 0002 + 0003 so the badges behave identically.
 */
export function listingsPublic(): ListingPublic[] {
  return getProperties()
    .filter((p) => p.status === "live")
    .map((p) => {
    const poster = getProfiles().find((u) => u.id === p.posted_by) ?? null;
    // Counted live, so filing a report immediately affects the badge.
    const openMismatches = getMismatches().filter(
      (m) => m.property_id === p.id && m.status === "open",
    ).length;

    // Same as the cover/count/coverage lateral joins in 0006 + 0008.
    // The hall leads: it's the room a tenant judges first.
    const photos = getPhotos()
      .filter((ph) => ph.property_id === p.id)
      .sort(
        (a, b) =>
          Number(a.room_type !== "hall") - Number(b.room_type !== "hall") ||
          a.sort_order - b.sort_order,
      );
    const cover = photos[0] ?? null;

    // Balconies and exteriors don't fill a bedroom, so they don't count.
    const roomsCovered = photos.filter((ph) =>
      REQUIRED_ROOM_TYPES.has(ph.room_type),
    ).length;

    const daysSinceVerified =
      p.last_verified_at === null
        ? null
        : Math.floor((Date.now() - Date.parse(p.last_verified_at)) / 86_400_000);

    return {
      id: p.id,
      locality_id: p.locality_id,
      locality_slug: LOCALITY.slug,
      area_id: p.area_id,
      area_slug: p.area_id ? p.area_id.replace("area-", "") : null,
      area_name: AREAS.find((a) => a.id === p.area_id)?.name ?? null,
      latitude: p.latitude,
      longitude: p.longitude,
      title: p.title,
      description: p.description,
      address_line: p.address_line,
      bhk: p.bhk,
      furnishing: p.furnishing,
      occupancy_pref: p.occupancy_pref,
      rent: p.rent,
      deposit: p.deposit,
      maintenance_monthly: p.maintenance_monthly,
      brokerage: p.brokerage,
      brokerage_disclosed: p.brokerage_disclosed,
      one_time_charges: p.one_time_charges,
      all_in_monthly: p.rent + p.maintenance_monthly,
      move_in_cost: p.deposit + p.brokerage + p.one_time_charges,
      available_from: p.available_from,
      availability: p.availability,
      last_verified_at: p.last_verified_at,
      // Mirrors the `verified_by_poster` expression in 0009's view.
      verified_by_poster: p.last_verified_by !== null && p.last_verified_by === p.posted_by,
      days_since_verified: daysSinceVerified,
      is_stale:
        daysSinceVerified === null || daysSinceVerified > LOCALITY.verify_stale_days,
      posted_by_role: poster?.role ?? null,
      posted_by_name: poster?.full_name ?? null,
      posted_by: p.posted_by,
      open_mismatch_count: openMismatches,
      has_warning: openMismatches >= 2,
      cover_photo_path: cover?.storage_path ?? null,
      cover_photo_captured_at: cover?.captured_at ?? null,
      photo_count: photos.length,
      rooms_required: roomsRequiredForBhk(p.bhk),
      rooms_covered: roomsCovered,
      created_at: p.created_at,
    };
  });
}
