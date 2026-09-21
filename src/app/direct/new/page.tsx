import { SiteHeader } from "@/components/site-header";
import { NewDirectListingClient } from "@/components/direct/new-direct-listing-client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "List a Room or Flat Directly — Kiraya Direct",
  description: "Strictly zero brokerage. List your available room or flat directly to verified corporate professionals in Pune.",
};

export default function NewDirectListingPage() {
  return (
    <div className="relative min-h-dvh overflow-hidden bg-background">
      <SiteHeader />
      <NewDirectListingClient />
    </div>
  );
}
