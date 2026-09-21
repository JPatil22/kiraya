import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

function loadEnv(file) {
  try {
    for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
      const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
      if (!m) continue;
      const value = m[2].trim().replace(/^["']|["']$/g, "");
      if (!(m[1] in process.env)) process.env[m[1]] = value;
    }
  } catch {}
}
loadEnv(".env.local");

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const BEDROOMS_FOR_BHK = {
  "1rk": 0,
  "1bhk": 1,
  "2bhk": 2,
  "3bhk": 3,
  "4plus": 4,
};

const BATHROOMS_FOR_BHK = {
  "1rk": 1,
  "1bhk": 1,
  "2bhk": 2,
  "3bhk": 2,
  "4plus": 3,
};

function candidateSlotsForBhk(bhk) {
  const bedrooms = BEDROOMS_FOR_BHK[bhk] ?? 2;
  const bathrooms = BATHROOMS_FOR_BHK[bhk] ?? 2;
  const slots = [
    { roomType: "hall", roomIndex: 1 },
  ];
  for (let i = 1; i <= bedrooms; i++) {
    slots.push({ roomType: "bedroom", roomIndex: i });
  }
  slots.push({ roomType: "kitchen", roomIndex: 1 });
  for (let i = 1; i <= bathrooms; i++) {
    slots.push({ roomType: "bathroom", roomIndex: i });
  }
  slots.push({ roomType: "balcony", roomIndex: 1 });
  slots.push({ roomType: "exterior", roomIndex: 1 });
  return slots;
}

async function promoteForListing(propertyId) {
  const { data: prop } = await supabase
    .from("properties")
    .select("id, title, bhk, posted_by, status")
    .eq("id", propertyId)
    .single();
  if (!prop) return;

  const { data: staged } = await supabase
    .from("ingest_photos")
    .select("*")
    .eq("property_id", propertyId)
    .order("created_at", { ascending: true });

  if (!staged || staged.length === 0) {
    console.log(`[${prop.id}] No staged photos to promote.`);
    return;
  }

  const { data: existing } = await supabase
    .from("property_photos")
    .select("room_type, room_index")
    .eq("property_id", propertyId);

  const occupied = new Set((existing ?? []).map((p) => `${p.room_type}:${p.room_index}`));
  const candidateSlots = candidateSlotsForBhk(prop.bhk);
  const availableSlots = candidateSlots.filter(
    (s) => !occupied.has(`${s.roomType}:${s.roomIndex}`)
  );

  console.log(`[${prop.id}] "${prop.title}": ${staged.length} staged photos, ${availableSlots.length} available slots.`);

  const toInsert = [];
  const stagedIdsToDelete = [];
  const countToPromote = Math.min(staged.length, availableSlots.length);

  for (let i = 0; i < countToPromote; i++) {
    const s = staged[i];
    const slot = availableSlots[i];
    toInsert.push({
      property_id: propertyId,
      storage_path: s.storage_path,
      thumbnail_path: s.thumbnail_path,
      room_type: slot.roomType,
      room_index: slot.roomIndex,
      sort_order: i,
      captured_at: null,
      created_by: prop.posted_by,
    });
    stagedIdsToDelete.push(s.id);
  }

  if (toInsert.length > 0) {
    const { error: insertErr } = await supabase.from("property_photos").insert(toInsert);
    if (insertErr) {
      console.error(`  Error inserting property_photos:`, insertErr.message);
      return;
    }
    const { error: delErr } = await supabase.from("ingest_photos").delete().in("id", stagedIdsToDelete);
    console.log(`  ✓ Successfully promoted ${toInsert.length} photos to property_photos (slots: ${toInsert.map(p => `${p.room_type}:${p.room_index}`).join(", ")})`);
    if (delErr) console.warn("  Warning deleting ingest_photos:", delErr.message);
  }
}

async function main() {
  const { data: props } = await supabase
    .from("properties")
    .select("id, title, status")
    .eq("status", "live");

  console.log(`Found ${props?.length || 0} live properties.`);
  for (const p of props || []) {
    await promoteForListing(p.id);
  }
}
main();
