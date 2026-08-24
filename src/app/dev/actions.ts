"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { DEV_ROLE_COOKIE, OPEN_MODE, isDevRole } from "@/lib/open-mode";

/** Only same-origin, absolute-path destinations — never an open redirect. */
function safeReturnTo(value: FormDataEntryValue | null): string {
  if (typeof value !== "string") return "/dashboard";
  if (!value.startsWith("/") || value.startsWith("//")) return "/dashboard";
  return value;
}

/**
 * Switch the role the open-mode sandbox acts as. Inert unless open mode is on,
 * so this can never become a privilege-escalation path in a real deployment.
 *
 * Ends in a redirect rather than `revalidatePath` on purpose: a cookie written
 * here isn't visible to the re-render of the same request, so the new role only
 * takes effect on a fresh GET.
 */
export async function setDevRole(formData: FormData) {
  if (!OPEN_MODE) return;

  const returnTo = safeReturnTo(formData.get("returnTo"));
  const role = formData.get("role");

  if (isDevRole(role)) {
    const cookieStore = await cookies();
    cookieStore.set(DEV_ROLE_COOKIE, role, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
  }

  redirect(returnTo);
}
