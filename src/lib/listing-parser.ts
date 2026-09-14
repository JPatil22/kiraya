// Zero-Credential Indian Real Estate Listing Parser
// Extracts BHK, Rent, Deposit, Phone, Furnishing, Occupancy from Facebook text without any AI key!

export interface ParsedRentalListing {
  title: string;
  /** The focused post text, stripped of Facebook chrome — the listing's description. */
  cleanText: string;
  rent: number | null;
  deposit: number | null;
  /** Rupees. 0 = post says "no brokerage"; null = post is silent on it. */
  brokerage: number | null;
  bhk: "1rk" | "1bhk" | "2bhk" | "3bhk" | "4plus";
  furnishing: "unfurnished" | "semi" | "full";
  occupancy_pref: "family" | "bachelors_male" | "bachelors_female" | "any";
  address_line: string | null;
  phone: string | null;
  /** The contact person's name, when the post pairs one with the number. */
  sourceName: string | null;
}

/** Listing words that sit next to a number but aren't a person's name. */
const NAME_STOP =
  /^(rent|deposit|contact|call|whatsapp|whats|available|family|families|single|singles|girl|girls|boy|boys|bachelor|bachelors|semi|fully|furnished|unfurnished|flat|apartment|bhk|rk|location|society|near|road|nagar|chowk|phase|prime|spacious|modular|kitchen|parking|lift|security|month|monthly|visit|negotiable|highlights|details|amenities|owner|broker|agent|immediate|working|professional|preferred|only|slightly|the|for|and)$/i;

/**
 * The contact person's name, when the post writes it next to the number —
 * "Contact: 98… – Anuraj", "SACHIN--98…", "98… - Rahul". Best-effort: skips the
 * listing vocabulary that also sits near a number, and returns null rather than
 * guess. Never a phone or a common word.
 */
function extractSourceName(text: string): string | null {
  // A person's name: one to three capitalised words. Broad enough for "Rajesh
  // Sharma", tight enough to skip a sentence.
  const NAME = "[A-Za-z][a-zA-Z]{1,19}(?:\\s+[A-Za-z][a-zA-Z]{1,19}){0,2}";
  const cands: string[] = [];
  let m: RegExpExecArray | null;
  // "Contact: Rajesh Sharma - 98…" — full name between the label and the number.
  const re0 = new RegExp(`(?:contact|call|whats?\\s?app|name|posted by|broker)\\s*[:\\-]?\\s*(${NAME})\\s*[-–—:]?\\s*(?:\\+?91[\\s-]?)?[6-9]\\d{9}`, "gi");
  while ((m = re0.exec(text))) cands.push(m[1]);
  // "Name - 98…" / "SACHIN--98…"
  const re1 = new RegExp(`\\b(${NAME})\\s*[-–—]{1,2}\\s*(?:\\+?91[\\s-]?)?[6-9]\\d{9}`, "g");
  while ((m = re1.exec(text))) cands.push(m[1]);
  // "Contact … – Name" (name after the number/label)
  const re2 = /(?:contact|call|whats?\s?app|name)\b[^\n]{0,40}?[-–—]\s*([A-Za-z][a-zA-Z]{2,19})/gi;
  while ((m = re2.exec(text))) cands.push(m[1]);
  // "98… - Name"
  const re3 = /[6-9]\d{9}\s*[-–—]\s*([A-Za-z][a-zA-Z]{2,19})/g;
  while ((m = re3.exec(text))) cands.push(m[1]);
  // Accept the first candidate whose FIRST word isn't listing vocabulary.
  const raw = cands.map((c) => c.trim()).find((c) => c && !NAME_STOP.test(c.split(/\s+/)[0]));
  if (!raw) return null;
  // Title-case each word of an all-caps name (SACHIN → Sachin); leave the rest.
  return raw
    .split(/\s+/)
    .map((w) => (w === w.toUpperCase() ? w[0] + w.slice(1).toLowerCase() : w))
    .join(" ");
}

/**
 * Lines Facebook's own UI injects into a scraped post's innerText. Any line
 * matching one of these is not part of the listing and must never become its
 * title. Kept deliberately broad — a dropped real line only costs us the next
 * candidate, but a kept chrome line names the flat after Facebook's chrome.
 */
const FB_CHROME_PATTERNS: RegExp[] = [
  /what's on your mind/i,
  /write something/i,
  /write a (public )?comment/i,
  /^see (more|less|translation|original)/i,
  /^(like|comment|share|reply|send|follow|save|report)$/i,
  /all reactions/i,
  /most relevant|newest|top comments/i,
  /^(public|private) group/i,
  /top contributor|anonymous (member|participant|post)/i,
  /·\s*follow/i,
  /^\d+\s*(comments?|shares?|reactions?)\b/i,
  /\bmembers?\b.*\bjoined\b/i,
  /^\d[\d.,]*k?\s*members?$/i,
  // Group-feed nav / composer chrome that leaks in as its own lines.
  /^(invite|joined|about|discussion|people|events|media|files|more)$/i,
  /feeling\/activity/i,
  /^poll$/i,
  /sort group feed by/i,
  /^ai content$/i,
  // A bare relative timestamp ("5h", "2d", "Just now", "Yesterday at 5:00").
  /^(just now|yesterday|\d+\s*(m|min|h|hr|hrs|d|w|y)\b)/i,
  /^\s*(facebook|meta)\s*$/i,
  // Post-body engagement chrome that trails a group post.
  /are you interested in this post/i,
  /^(interested|not interested)$/i,
  /^no comments?\s*yet/i,
  /be the first to comment/i,
  /^\+\d+$/, // the "+16" more-photos overlay
];

function isFacebookChrome(line: string): boolean {
  return FB_CHROME_PATTERNS.some((re) => re.test(line));
}

/** Any mention of a configuration ("2 BHK", "1 RK") — headline or body line. */
const HEADLINE_RE = /\b\d\s*(?:bhk|rk)\b/i;

/**
 * A *new post's* headline: a configuration that also announces a letting
 * ("2 BHK … for rent", "available … 3 BHK"). This is the real post boundary —
 * NOT a bare "2BHK Semi Furnished Flat" line repeated in the body, which posts
 * do all the time (and which must not truncate the listing before its rent).
 */
const STRONG_HEADLINE_RE =
  /\b\d\s*(?:bhk|rk)\b[^\n]*\b(?:for\s+rent|available|rent\b)|\b(?:for\s+rent|available)\b[^\n]*\b\d\s*(?:bhk|rk)\b/i;

/**
 * A scraped group feed can carry several posts and a pile of group chrome. Focus
 * on ONE listing: start at the first "N BHK/RK" line and stop at the *next post's
 * headline* (a configuration line that also says "for rent"/"available") or the
 * hashtags. A bare BHK line in the body is kept — breaking on it would cut the
 * post off before its rent/deposit. Two distinct posts still separate cleanly,
 * because the second one's headline announces its own letting.
 */
function focusListing(lines: string[]): { headline: string | null; lines: string[] } {
  const start = lines.findIndex((l) => HEADLINE_RE.test(l));
  if (start === -1) return { headline: null, lines };

  const windowLines: string[] = [lines[start]];
  for (let i = start + 1; i < lines.length && windowLines.length < 30; i += 1) {
    const line = lines[i];
    if (STRONG_HEADLINE_RE.test(line)) break; // the next post's headline
    if (/^#/.test(line)) break; // hashtags close a post
    windowLines.push(line);
  }
  return { headline: lines[start], lines: windowLines };
}

/** A clean title from parsed fields, for when the post text yields no headline. */
function fallbackTitle(
  bhk: ParsedRentalListing['bhk'],
  furnishing: ParsedRentalListing['furnishing'],
): string {
  const bhkLabel = bhk === '1rk' ? '1 RK' : bhk.replace('bhk', ' BHK').replace('plus', '+ BHK').toUpperCase();
  const furnish = furnishing === 'full' ? 'furnished ' : furnishing === 'unfurnished' ? 'unfurnished ' : '';
  return `${bhkLabel} ${furnish}flat for rent`.replace(/\s+/g, ' ').trim();
}

export function parseListingText(rawText: string): ParsedRentalListing {
  // Drop Facebook chrome, then narrow to a single post. All field extraction
  // below runs on this focused text, not the whole scraped blob — so a feed with
  // several posts yields the ONE the headline belongs to, not a blend of them.
  const cleanLines = rawText
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 5 && !isFacebookChrome(l));
  const focus = focusListing(cleanLines);
  const scopeLines = focus.lines;
  // Drop thousands-separator commas (28,000 → 28000) so amount regexes see the
  // whole number, not just the first group. Only commas *between digits* go —
  // "family, single" keeps its comma.
  const text = scopeLines.join(' ').replace(/\s+/g, ' ').replace(/(?<=\d),(?=\d)/g, '');

  // 1. Extract BHK
  let bhk: ParsedRentalListing['bhk'] = "2bhk";
  if (/\b1\s*rk\b/i.test(text)) bhk = "1rk";
  else if (/\b1\s*bhk\b/i.test(text)) bhk = "1bhk";
  else if (/\b2\s*bhk\b/i.test(text)) bhk = "2bhk";
  else if (/\b3\s*bhk\b/i.test(text)) bhk = "3bhk";
  else if (/\b(4|5)\s*bhk\b/i.test(text)) bhk = "4plus";

  // 2. Extract Phone Number (10 digit Indian mobile numbers) — from the focused
  // post, so we don't grab the number of a different flat further down the feed.
  const phoneMatch = text.match(/\b[6-9]\d{9}\b/);
  const phone = phoneMatch ? phoneMatch[0] : null;
  const sourceName = extractSourceName(text);

  // Separator between a label and its number: any run of spaces, colons,
  // hyphens (incl. the doubled "RENT--32K"), en/em dashes, dots or equals.
  const SEP = String.raw`[\s:.=\-–—]*`;

  // 3. Extract Rent
  let rent: number | null = null;
  // Match "Rent : 35k", "Rent: ₹35,000", "Rent 35000", "RENT--32K", "30k rent".
  const rentMatch = text.match(new RegExp(`rent${SEP}₹?\\s*(\\d{1,2})\\s*[kK]\\b`, "i")) ||
                    text.match(new RegExp(`rent${SEP}₹?\\s*(\\d{2,6})`, "i")) ||
                    text.match(/₹?\s*(\d{1,2})\s*[kK]\s*rent/i);
  if (rentMatch) {
    const val = parseInt(rentMatch[1], 10);
    rent = val < 200 ? val * 1000 : val;
  }

  // 4. Extract Deposit
  let deposit: number | null = null;
  const depositMatch = text.match(new RegExp(`deposit${SEP}₹?\\s*(\\d{1,3})\\s*[kK]\\b`, "i")) ||
                        text.match(new RegExp(`deposit${SEP}₹?\\s*(\\d{2,6})`, "i"));
  if (depositMatch) {
    const val = parseInt(depositMatch[1], 10);
    deposit = val < 500 ? val * 1000 : val;
  } else if (rent && new RegExp(`deposit${SEP}2\\s*months`, "i").test(text)) {
    deposit = rent * 2;
  }

  // 4b. Extract Brokerage. A broker states it as a flat amount ("brokerage
  // 15k"), or as a slice of rent ("brokerage 1 month", "15 days brokerage"),
  // or says there is none ("no brokerage"). null means the post never mentions
  // it — the caller decides what an unstated broker fee defaults to.
  let brokerage: number | null = null;
  if (/\b(no|zero|nil|without)\s*brokerage\b/i.test(text) || new RegExp(`\\bbrokerage${SEP}(0|nil|none)\\b`, "i").test(text)) {
    brokerage = 0;
  } else {
    const bMonths =
      text.match(new RegExp(`brokerage${SEP}₹?\\s*(\\d+(?:\\.\\d+)?)\\s*months?`, "i")) ||
      text.match(/(\d+(?:\.\d+)?)\s*months?\s*(?:rent\s*)?(?:as\s*)?brokerage/i);
    const bDays =
      text.match(new RegExp(`brokerage${SEP}(\\d+)\\s*days?`, "i")) ||
      text.match(/(\d+)\s*days?\s*brokerage/i);
    const bAmount =
      text.match(new RegExp(`brokerage${SEP}₹?\\s*(\\d{1,2})\\s*[kK]\\b`, "i")) ||
      text.match(new RegExp(`brokerage${SEP}₹?\\s*(\\d{3,6})\\b`, "i")) ||
      text.match(/₹?\s*(\d{1,2})\s*[kK]\s*brokerage/i) ||
      text.match(/₹?\s*(\d{3,6})\s*brokerage/i);
    if (bMonths && rent) {
      brokerage = Math.round(parseFloat(bMonths[1]) * rent);
    } else if (bDays && rent) {
      brokerage = Math.round((parseInt(bDays[1], 10) / 30) * rent);
    } else if (bAmount) {
      const val = parseInt(bAmount[1], 10);
      brokerage = val < 200 ? val * 1000 : val;
    }
  }

  // 5. Extract Furnishing
  let furnishing: ParsedRentalListing['furnishing'] = "semi";
  if (/fully\s*furnished/i.test(text) || /full\s*furnished/i.test(text)) {
    furnishing = "full";
  } else if (/unfurnished/i.test(text) || /empty/i.test(text)) {
    furnishing = "unfurnished";
  } else if (/semi\s*furnished/i.test(text)) {
    furnishing = "semi";
  }

  // 6. Extract Occupancy Preference. A post that welcomes both a family and
  // bachelors ("family & bachelor girls allow") is open to anyone, so only the
  // *exclusive* single-group posts narrow the preference.
  let occupancy_pref: ParsedRentalListing['occupancy_pref'] = "any";
  const wantsFamily = /family|families/i.test(text);
  const wantsFemale = /bachelor\s*girls|girls?\s*(?:only|allow|allowed|preferred)|\bfemales?\b/i.test(text);
  const wantsMale = /bachelor\s*boys|boys?\s*(?:only|allow|allowed|preferred)|\bmales?\b/i.test(text);
  const wantsBachelor = /bachelors?\b/i.test(text) || wantsFemale || wantsMale;
  if (wantsFamily && wantsBachelor) {
    occupancy_pref = "any";
  } else if (wantsFamily) {
    occupancy_pref = "family";
  } else if (wantsFemale && !wantsMale) {
    occupancy_pref = "bachelors_female";
  } else if (wantsMale && !wantsFemale) {
    occupancy_pref = "bachelors_male";
  }

  // 7. Title & Address, from the focused post's lines.
  //
  // The headline the focus started from ("2 BHK … for Rent") is the title. With
  // no headline (a terse post), fall back to the first line that reads like a
  // listing, then to a title built from parsed fields — never Facebook's chrome.
  const listingLine =
    focus.headline ??
    scopeLines.find((l) =>
      /\b\d\s*(rk|bhk)\b|\bfor\s+rent\b|\bflat\b|\bapartment\b|\bavailable\b|\brent\b/i.test(l),
    ) ??
    scopeLines[0] ??
    '';
  const title = listingLine.substring(0, 120) || fallbackTitle(bhk, furnishing);

  const locationLine =
    scopeLines.find((l) => /location|society|near|\bat\b|road|nagar|chowk|phase/i.test(l)) || null;
  const address_line = locationLine
    ? locationLine.replace(/location\s*[:\-]/i, '').trim().substring(0, 200)
    : null;

  return {
    title,
    // The focused, chrome-free post text — a clean description a tenant can read,
    // not the whole scraped blob with its "Facebook" nav and comment furniture.
    cleanText: scopeLines.join("\n"),
    rent,
    deposit,
    brokerage,
    bhk,
    furnishing,
    occupancy_pref,
    address_line,
    phone,
    sourceName,
  };
}
