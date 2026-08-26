import { cache } from "react";
import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { createFixtureClient } from "@/lib/fixtures/client";
import {
  DEFAULT_DEV_ROLE,
  DEV_PHONES,
  DEV_ROLE_COOKIE,
  OPEN_MODE,
  USE_FIXTURES,
  isDevRole,
} from "@/lib/open-mode";
import type { Database, OnboardingStep, UserRole } from "@/types/database";

/**
 * The acting identity for a request — real OTP session or open-mode stand-in.
 * Everything that used to call `supabase.auth.getUser()` directly goes through
 * here, so restoring the auth gate is a single env flip rather than an edit
 * across every page and action.
 */
export type SessionUser = {
  id: string;
  phone: string | null;
  /** 0026 — where notifications are emailed, if they asked for that. */
  email: string | null;
  fullName: string | null;
  role: UserRole | null;
  onboardingStep: OnboardingStep;
  isSuspended: boolean;
  /** True when this came from open mode rather than a verified phone. */
  isDev: boolean;
};

/** The role the open-mode sandbox is currently acting as. */
export async function getDevRole(): Promise<UserRole> {
  const cookieStore = await cookies();
  const value = cookieStore.get(DEV_ROLE_COOKIE)?.value;
  return isDevRole(value) ? value : DEFAULT_DEV_ROLE;
}

/**
 * The client app queries should run through. Three cases:
 *   • fixtures  — in-memory data, no database at all (UI walkthroughs)
 *   • open mode — no session, so RLS would expose nothing but `live` listings;
 *                 falls back to service-role
 *   • normal    — the cookie-bound client, RLS fully in force
 */
/**
 * `cache()` so one request reuses a single client instance. That matters twice
 * over: it avoids rebuilding the client per call, and it gives `getSessionUser`
 * a stable cache key (React keys on argument identity).
 */
export const getDataClient = cache(async (): Promise<SupabaseClient<Database>> => {
  if (USE_FIXTURES) return createFixtureClient();
  return OPEN_MODE ? createServiceClient() : createClient();
});

/**
 * Resolve the acting user. Returns null when nobody is signed in — and, in open
 * mode, when the dev identities haven't been seeded yet (`npm run db:seed`),
 * which callers surface as a setup hint rather than a redirect to /login.
 */
export const getSessionUser = cache(async function getSessionUser(
  supabase: SupabaseClient<Database>,
): Promise<SessionUser | null> {
  if (OPEN_MODE) {
    const role = await getDevRole();
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("phone", DEV_PHONES[role])
      .maybeSingle();

    if (!data) return null;

    return {
      id: data.id,
      phone: data.phone,
      email: data.email,
      fullName: data.full_name,
      // Trust the cookie over the stored role: the switcher is the control.
      role,
      onboardingStep: "done",
      isSuspended: data.is_suspended,
      isDev: true,
    };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  return {
    id: user.id,
    phone: profile?.phone ?? user.phone ?? null,
    email: profile?.email ?? user.email ?? null,
    fullName: profile?.full_name ?? null,
    role: profile?.role ?? null,
    onboardingStep: profile?.onboarding_step ?? "role",
    isSuspended: profile?.is_suspended ?? false,
    isDev: false,
  };
});

/** Owners, brokers and admins may post; tenants may not. */
export function canPost(role: UserRole | null): boolean {
  return role === "owner" || role === "broker" || role === "admin";
}

/**
 * A phone number is required to transact (0030).
 *
 * Google proves an email; the contact exchange trades phone numbers. Onboarding
 * asks for one, so this catches accounts that predate 0030 and anyone who
 * reached an action another way — belt and braces on the two points where a
 * missing number would strand somebody mid-flow.
 */
export function needsPhone(user: { phone: string | null }): string | null {
  return user.phone
    ? null
    : "Add your mobile number first — it's what gets exchanged when someone enquires.";
}
