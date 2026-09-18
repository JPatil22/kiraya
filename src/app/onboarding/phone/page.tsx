import { redirect } from "next/navigation";
import { getDataClient, getSessionUser } from "@/lib/auth";
import { OPEN_MODE } from "@/lib/open-mode";
import { PageHeader } from "@/components/ui/page-header";
import { PhoneForm } from "./phone-form";

export const dynamic = "force-dynamic";

/**
 * Onboarding step 2 — the number (0030).
 *
 * Google proved an email, which is free to create in bulk. This is the number
 * the contact exchange will hand to whoever you enquire with, and the one
 * you'll be given in return, because an Indian rental happens on a phone call.
 *
 * Asked once here rather than ambushing somebody mid-enquiry. Browsing the feed
 * never needed a sign-in at all, so anybody who reached this page arrived
 * intending to do something.
 */
export default async function PhonePage() {
  const supabase = await getDataClient();
  const user = await getSessionUser(supabase);

  if (!user) {
    if (!OPEN_MODE) redirect("/login");
    redirect("/dashboard");
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 py-10">
      <div className="mb-8">
        <p className="text-sm font-medium text-muted-foreground">Step 2</p>
        <PageHeader
          className="mt-1"
          title="Your mobile number"
          description="Nobody sees it until you ask for someone's details, or they ask for yours — and then you both get each other's at the same moment. Never shown on a listing, never sold."
        />
      </div>

      <PhoneForm initial={user.phone ?? ""} />
    </main>
  );
}
