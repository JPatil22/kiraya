import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { OpenModeSeedHint } from "@/components/open-mode-seed-hint";
import { Button } from "@/components/ui/button";
import { getDataClient, getDevRole, getSessionUser } from "@/lib/auth";
import { OPEN_MODE } from "@/lib/open-mode";
import { getPhotos } from "@/lib/photos";
import { PhotoManager } from "./photo-manager";

export const dynamic = "force-dynamic";

export default async function ListingPhotosPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await getDataClient();
  const user = await getSessionUser(supabase);

  if (!user) {
    if (!OPEN_MODE) redirect("/login");
    const devRole = await getDevRole();
    return (
      <div className="min-h-dvh">
        <SiteHeader />
        <main className="mx-auto max-w-3xl px-6 py-8">
          <OpenModeSeedHint role={devRole} />
        </main>
      </div>
    );
  }

  const { data: property } = await supabase
    .from("properties")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!property) notFound();

  // Managing photos is the poster's job, or an admin's.
  if (property.posted_by !== user.id && user.role !== "admin") redirect(`/listings/${id}`);

  const photos = await getPhotos(supabase, id);

  return (
    <div className="min-h-dvh">
      <SiteHeader />

      <main className="mx-auto max-w-3xl space-y-6 px-6 py-8">
        <Button asChild variant="ghost" size="sm" className="-ml-3">
          <Link href={property.status === "live" ? `/listings/${id}` : "/dashboard"}>
            <ArrowLeft /> Back
          </Link>
        </Button>

        <div>
          <h1 className="text-2xl font-bold tracking-tight">Photos</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {property.title}
          </p>
          <p className="mt-3 text-sm text-muted-foreground">
            One photo per room, not a pile. Tenants see exactly which rooms you&apos;ve shown
            and which you haven&apos;t — a missing bedroom reads as something hidden. Each
            photo also carries its own date, shown next to the verification date.
          </p>
        </div>

        <PhotoManager
          propertyId={id}
          bhk={property.bhk}
          photos={photos}
          lastVerifiedAt={property.last_verified_at}
        />
      </main>
    </div>
  );
}
