import { NextResponse, type NextRequest } from "next/server";
import { createMiddlewareClient } from "@/lib/supabase/middleware";
import { DEV_PATH_HEADER, OPEN_MODE } from "@/lib/open-mode";
import type { OnboardingStep } from "@/types/database";

const AUTH_ROUTES = ["/login", "/verify"];

/** OAuth comes back here before a session exists; it must never be redirected. */
const CALLBACK_ROUTE = "/auth/callback";

function isOnboardingRoute(path: string) {
  return path.startsWith("/onboarding");
}

/**
 * Routes that require an authenticated, fully-onboarded user.
 * `/listings` itself stays public — browsing is the top of the funnel — but
 * posting a property, the tenant inbox and the broker demand view are not.
 */
function isAppRoute(path: string) {
  return (
    path.startsWith("/dashboard") ||
    path.startsWith("/intent") ||
    path.startsWith("/listings/new") ||
    path.startsWith("/suggestions") ||
    path.startsWith("/broker") ||
    path.startsWith("/admin")
  );
}

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // The OAuth code is exchanged for a session inside the route handler, so at
  // this point the user legitimately looks signed out. Bouncing them to /login
  // here would make Google sign-in loop forever.
  if (path === CALLBACK_ROUTE) return NextResponse.next();

  // --- Open mode ------------------------------------------------------------
  // Nothing to gate: no session to refresh, no onboarding step to enforce. The
  // OTP funnel is dormant, so bounce its routes instead of leaving dead ends
  // that would fail at `signInWithOtp`. See src/lib/open-mode.ts.
  if (OPEN_MODE) {
    if (AUTH_ROUTES.includes(path) || isOnboardingRoute(path)) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
    // Stamp the path so the role switcher knows where to send you back to.
    const headers = new Headers(request.headers);
    headers.set(DEV_PATH_HEADER, `${path}${request.nextUrl.search}`);
    return NextResponse.next({ request: { headers } });
  }

  const { supabase, response } = createMiddlewareClient(request);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const redirect = (to: string) =>
    NextResponse.redirect(new URL(to, request.url), { headers: response.headers });

  // --- Unauthenticated ------------------------------------------------------
  if (!user) {
    if (isAppRoute(path) || isOnboardingRoute(path)) return redirect("/login");
    return response;
  }

  // --- Authenticated: resolve onboarding step -------------------------------
  const { data: profile } = await supabase
    .from("profiles")
    .select("onboarding_step")
    .eq("id", user.id)
    .maybeSingle();

  const step: OnboardingStep = profile?.onboarding_step ?? "role";

  // Keep authed users out of the auth screens.
  if (AUTH_ROUTES.includes(path)) {
    return redirect(step === "done" ? "/dashboard" : `/onboarding/${step}`);
  }

  // Mid-onboarding: force the user onto their current step everywhere else.
  if (step !== "done") {
    const target = `/onboarding/${step}`;
    if (path !== target && (isAppRoute(path) || isOnboardingRoute(path) || path === "/")) {
      return redirect(target);
    }
    return response;
  }

  // Fully onboarded: don't let them revisit onboarding.
  if (isOnboardingRoute(path)) return redirect("/dashboard");

  return response;
}

export const config = {
  // Run on everything except static assets and image optimisation.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
