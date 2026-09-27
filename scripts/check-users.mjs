import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

function loadEnv() {
  const envPath = path.resolve(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) return;
  const content = fs.readFileSync(envPath, "utf8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim();
    process.env[key] = val;
  }
}

loadEnv();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error("Missing SUPABASE env vars in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey);

async function checkUsers() {
  console.log("=== Checking Supabase Profiles Table ===");
  const { data: profiles, error: profileErr } = await supabase
    .from("profiles")
    .select("id, full_name, phone, role, created_at")
    .order("created_at", { ascending: false });

  if (profileErr) {
    console.error("Profile query error:", profileErr);
  } else {
    console.log(`Total profiles in DB: ${profiles.length}`);
    console.table(profiles);
  }

  console.log("\n=== Checking Auth Users (Supabase Auth API) ===");
  const { data: authUsers, error: authErr } = await supabase.auth.admin.listUsers();
  if (authErr) {
    console.error("Auth users query error:", authErr);
  } else {
    console.log(`Total auth.users count: ${authUsers.users.length}`);
    const summary = authUsers.users.map(u => ({
      id: u.id,
      email: u.email,
      phone: u.phone,
      created_at: u.created_at,
      last_sign_in_at: u.last_sign_in_at,
      providers: u.app_metadata?.providers || [],
    }));
    console.table(summary);
  }
}

checkUsers();
