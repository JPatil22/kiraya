import { ACTIVE_LOCALITY_SLUG } from "@/lib/locality";
import { DEV_PHONES } from "@/lib/open-mode";
import { roomsRequiredForBhk } from "@/lib/rooms";
import type {
  BrokerSuggestion,
  ContactExchange,
  Area,
  DuplicateCandidate,
  ListingAccuracy,
  ListingEngagement,
  PriceContext,
  PublicAccuracy,
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
    // Seeded identities came in through OTP, so their numbers are proven.
    phone_verified_at: daysAgo(120),
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
    // Mirrors 0019 + 0029. Zone drives the dropdown grouping only.
    ["aundh", "Aundh", "West", 18.5590, 73.8078],
    ["balewadi", "Balewadi", "West", 18.5750, 73.7690],
    ["baner", "Baner", "West", 18.5590, 73.7770],
    ["bavdhan", "Bavdhan", "West", 18.5150, 73.7770],
    ["hinjewadi", "Hinjewadi", "West", 18.5910, 73.7380],
    ["pashan", "Pashan", "West", 18.5380, 73.7900],
    ["wakad", "Wakad", "West", 18.5987, 73.7614],
    ["shivajinagar", "Shivajinagar", "Central", 18.5308, 73.8478],
    ["deccan", "Deccan", "Central", 18.5150, 73.8400],
    ["camp", "Camp", "Central", 18.5150, 73.8790],
    ["swargate", "Swargate", "Central", 18.5010, 73.8580],
    ["erandwane", "Erandwane", "Central", 18.5070, 73.8290],
    ["koregaon-park", "Koregaon Park", "Central", 18.5362, 73.8939],
    ["kharadi", "Kharadi", "East", 18.5515, 73.9436],
    ["viman-nagar", "Viman Nagar", "East", 18.5679, 73.9143],
    ["kalyani-nagar", "Kalyani Nagar", "East", 18.5480, 73.9010],
    ["wagholi", "Wagholi", "East", 18.5800, 73.9800],
    ["hadapsar", "Hadapsar", "South East", 18.5089, 73.9260],
    ["magarpatta", "Magarpatta", "South East", 18.5157, 73.9280],
    ["kondhwa", "Kondhwa", "South East", 18.4780, 73.8890],
    ["undri", "Undri", "South East", 18.4650, 73.9080],
    ["wanowrie", "Wanowrie", "South East", 18.4900, 73.8990],
    ["katraj", "Katraj", "South", 18.4530, 73.8580],
    ["ambegaon", "Ambegaon", "South", 18.4640, 73.8380],
    ["bibwewadi", "Bibwewadi", "South", 18.4770, 73.8630],
    ["kothrud", "Kothrud", "South West", 18.5074, 73.8077],
    ["karve-nagar", "Karve Nagar", "South West", 18.4890, 73.8180],
    ["narhe", "Narhe", "South West", 18.4560, 73.8300],
    ["warje", "Warje", "South West", 18.4830, 73.8020],
    ["sinhagad-road", "Sinhagad Road", "South West", 18.4700, 73.8250],
    ["pimple-saudagar", "Pimple Saudagar", "PCMC", 18.5980, 73.7900],
    ["pimpri", "Pimpri", "PCMC", 18.6280, 73.8000],
    ["chinchwad", "Chinchwad", "PCMC", 18.6420, 73.7600],
    ["ravet", "Ravet", "PCMC", 18.6480, 73.7440],
    ["thergaon", "Thergaon", "PCMC", 18.6000, 73.7620],
  ] as [string, string, string, number, number][]
).map(([slug, name, zone, latitude, longitude]) => ({
  id: `area-${slug}`,
  locality_id: LOCALITY.id,
  slug,
  name,
  zone,
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

// ---------------------------------------------------------------------------
// The four views that fixtures mode was missing (0015-0021).
//
// These existed only as SQL, so `NEXT_PUBLIC_USE_FIXTURES=true` threw the
// moment anything asked for them — the dashboard for any poster, and every
// listing detail page. Reimplemented here against the same store, following
// the migrations rather than approximating them, because a fixture that
// disagrees with the database is worse than no fixture at all.
// ---------------------------------------------------------------------------

/** Counts only, never who — 0017's promise, kept here too. */
export function listingEngagement(): ListingEngagement[] {
  const shortlists = getShortlists();
  const contacts = getContacts();
  const feedback = getVisits();

  return getProperties().map((p) => ({
    property_id: p.id,
    posted_by: p.posted_by,
    saves: shortlists.filter((s) => s.property_id === p.id).length,
    enquiries: contacts.filter((c) => c.property_id === p.id).length,
    visits_answered: feedback.filter(
      (f) => f.property_id === p.id && f.outcome !== "did_not_visit",
    ).length,
  }));
}

/** Outcome tallies (0015). "Didn't go" is a first-class answer, not a gap. */
export function listingAccuracy(): ListingAccuracy[] {
  const byProperty = new Map<string, VisitFeedback[]>();
  for (const f of getVisits()) {
    const list = byProperty.get(f.property_id);
    if (list) list.push(f);
    else byProperty.set(f.property_id, [f]);
  }

  return [...byProperty.entries()].map(([property_id, rows]) => ({
    property_id,
    answered: rows.filter((r) => r.outcome !== "did_not_visit").length,
    matched: rows.filter((r) => r.outcome === "as_described").length,
    mismatched: rows.filter((r) => r.outcome === "did_not_match").length,
    unreachable: rows.filter((r) => r.outcome === "unreachable").length,
    did_not_visit: rows.filter((r) => r.outcome === "did_not_visit").length,
  }));
}

/**
 * `percentile_cont(0.5)` — the continuous median Postgres computes, which
 * interpolates between the two middle values rather than picking one. Matching
 * it matters: a fixture that rounds differently makes "3% above the median"
 * disagree with production for no visible reason.
 */
function medianOf(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = (sorted.length - 1) / 2;
  const low = Math.floor(mid);
  const high = Math.ceil(mid);
  return low === high ? sorted[low] : sorted[low] + (sorted[high] - sorted[low]) * (mid - low);
}

/** 0016. The listing is excluded from its own comparison; rented is history. */
export function listingPriceContext(): PriceContext[] {
  const live = getProperties().filter((p) => p.status === "live");

  return live.map((p) => {
    const comparable = live.filter(
      (o) =>
        o.id !== p.id &&
        o.availability !== "rented" &&
        o.locality_id === p.locality_id &&
        o.bhk === p.bhk,
    );
    const allIn = p.rent + p.maintenance_monthly;
    const median = medianOf(comparable.map((o) => o.rent + o.maintenance_monthly));
    const medianInt = median === null ? null : Math.round(median);

    return {
      property_id: p.id,
      all_in_monthly: allIn,
      sample: comparable.length,
      median_all_in: medianInt,
      pct_vs_median:
        medianInt === null || medianInt === 0
          ? null
          : Math.round(((allIn - medianInt) / medianInt) * 100),
    };
  });
}

/**
 * pg_trgm's `similarity()`, which 0021 leans on.
 *
 * Postgres lowercases, splits on non-alphanumerics, pads each word with two
 * leading spaces and one trailing space, then counts shared trigrams over the
 * union. Implemented the same way so "Nyati Estate Rd" and "Nyati Estate Road"
 * score alike in both places — the whole point of the check.
 */
function trigrams(text: string): Set<string> {
  const out = new Set<string>();
  for (const word of text.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean)) {
    const padded = `  ${word} `;
    for (let i = 0; i + 3 <= padded.length; i += 1) out.add(padded.slice(i, i + 3));
  }
  return out;
}

function similarity(a: string, b: string): number {
  const left = trigrams(a);
  const right = trigrams(b);
  if (left.size === 0 && right.size === 0) return 0;
  let shared = 0;
  for (const t of left) if (right.has(t)) shared += 1;
  return shared / (left.size + right.size - shared);
}

/** 0021. Flagged, never merged. */
export function possibleDuplicates(): DuplicateCandidate[] {
  const live = getProperties().filter((p) => p.status === "live");
  const pairs: DuplicateCandidate[] = [];

  for (let i = 0; i < live.length; i += 1) {
    for (let j = i + 1; j < live.length; j += 1) {
      const a = live[i];
      const b = live[j];
      if (a.locality_id !== b.locality_id) continue;
      if (a.bhk !== b.bhk) continue;
      // `is not distinct from`: two nulls are the same area.
      if ((a.area_id ?? null) !== (b.area_id ?? null)) continue;

      const aAllIn = a.rent + a.maintenance_monthly;
      const bAllIn = b.rent + b.maintenance_monthly;
      if (Math.abs(aAllIn - bAllIn) > Math.max(aAllIn, bAllIn) * 0.05) continue;

      const score = similarity(a.address_line ?? a.title, b.address_line ?? b.title);
      if (score <= 0.3) continue;

      pairs.push({
        property_id: a.id,
        other_id: b.id,
        title: a.title,
        other_title: b.title,
        posted_by: a.posted_by,
        other_posted_by: b.posted_by,
        all_in_monthly: aAllIn,
        other_all_in_monthly: bAllIn,
        area_name: AREAS.find((ar) => ar.id === a.area_id)?.name ?? null,
        address_similarity: Math.round(score * 100) / 100,
        different_posters: a.posted_by !== b.posted_by,
      });
    }
  }

  return pairs;
}

/** 0031 — the public tally: three answers minimum, live listings only. */
export function listingAccuracyPublic(): PublicAccuracy[] {
  const live = new Set(getProperties().filter((p) => p.status === "live").map((p) => p.id));

  return listingAccuracy()
    .filter((a) => a.answered >= 3 && live.has(a.property_id))
    .map((a) => ({
      property_id: a.property_id,
      answered: a.answered,
      matched: a.matched,
      mismatched: a.mismatched,
      unreachable: a.unreachable,
      pct_matched: a.answered === 0 ? null : Math.round((a.matched / a.answered) * 100),
    }));
}
