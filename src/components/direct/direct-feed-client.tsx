"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Briefcase,
  Building,
  CheckCircle2,
  Filter,
  Home,
  Linkedin,
  Lock,
  PlusCircle,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DirectListingCard } from "./direct-listing-card";
import { VerificationModal, type VerifiedUser } from "./verification-modal";
import { ConnectModal } from "./connect-modal";
import { DirectGateCard } from "./direct-gate-card";
import {
  INITIAL_DIRECT_LISTINGS,
  getDirectListings,
  DIRECT_ACCESS_APPROVED_KEY,
  type DirectListing,
  type GenderPreference,
} from "@/lib/direct";

export function DirectFeedClient() {
  const [kindFilter, setKindFilter] = useState<"all" | "owner_flat" | "shared_room">("all");
  const [areaFilter, setAreaFilter] = useState<string>("all");
  const [genderFilter, setGenderFilter] = useState<GenderPreference | "all">("all");

  const [hasApprovedAccess, setHasApprovedAccess] = useState<boolean>(false);
  const [isCheckingAccess, setIsCheckingAccess] = useState<boolean>(true);
  const [verifiedUser, setVerifiedUser] = useState<VerifiedUser | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [activeListingToConnect, setActiveListingToConnect] = useState<DirectListing | null>(null);

  // Load verification and approval from localStorage on mount
  useEffect(() => {
    try {
      const approved = localStorage.getItem(DIRECT_ACCESS_APPROVED_KEY) === "true";
      setHasApprovedAccess(approved);
      const stored = localStorage.getItem("kiraya_verified_pro");
      if (stored) {
        setVerifiedUser(JSON.parse(stored));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsCheckingAccess(false);
    }
  }, []);

  // Listen for admin approval updates across tabs/storage
  useEffect(() => {
    const handleSync = () => {
      const approved = localStorage.getItem(DIRECT_ACCESS_APPROVED_KEY) === "true";
      setHasApprovedAccess(approved);
    };
    window.addEventListener("storage", handleSync);
    window.addEventListener("kiraya_direct_applications_updated", handleSync);
    return () => {
      window.removeEventListener("storage", handleSync);
      window.removeEventListener("kiraya_direct_applications_updated", handleSync);
    };
  }, []);

  const handleVerified = (user: VerifiedUser) => {
    setVerifiedUser(user);
    try {
      localStorage.setItem("kiraya_verified_pro", JSON.stringify(user));
    } catch (e) {
      console.error(e);
    }
    setIsVerifying(false);
    // If a listing was clicked before verifying, immediately open its connection
    if (activeListingToConnect) {
      // Keep it open
    }
  };

  const handleConnectClick = (listing: DirectListing) => {
    if (!verifiedUser) {
      setActiveListingToConnect(listing);
      setIsVerifying(true);
    } else {
      setActiveListingToConnect(listing);
    }
  };

  const listings = getDirectListings({
    kind: kindFilter,
    area: areaFilter,
    gender: genderFilter,
  });

  const areas = ["all", "Wakad", "Baner", "Hinjewadi", "Kharadi", "Kothrud"];

  if (isCheckingAccess) {
    return (
      <div className="flex justify-center items-center py-20 text-muted-foreground text-sm">
        <span className="size-2 rounded-full bg-primary animate-ping mr-2" />
        Checking membership clearance...
      </div>
    );
  }

  if (!hasApprovedAccess) {
    return <DirectGateCard onApproved={() => setHasApprovedAccess(true)} />;
  }

  return (
    <div className="space-y-8">
      {/* Approved Access Banner */}
      <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4 shadow-sm backdrop-blur-md">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600">
              <ShieldCheck className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 font-bold text-sm text-foreground">
                <span>Direct Community Access: Approved</span>
                <span className="rounded-full bg-emerald-600/15 border border-emerald-600/30 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-400">
                  Strictly ₹0 Brokerage
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                All flats are physically inspected &amp; legally verified. Direct WhatsApp &amp; phone contacts unlocked.
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              localStorage.removeItem(DIRECT_ACCESS_APPROVED_KEY);
              setHasApprovedAccess(false);
            }}
            className="text-xs text-muted-foreground hover:text-foreground h-8"
          >
            Relock Portal (Demo Test)
          </Button>
        </div>
      </div>

      {/* Main Filter & Navigation Bar */}
      <div className="space-y-4">
        {/* Top Dual Tabs + Post Button */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border/60 pb-4">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant={kindFilter === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => setKindFilter("all")}
              className="h-9 text-xs font-semibold rounded-full"
            >
              All Direct ({INITIAL_DIRECT_LISTINGS.length})
            </Button>

            <Button
              variant={kindFilter === "shared_room" ? "default" : "outline"}
              size="sm"
              onClick={() => setKindFilter("shared_room")}
              className="h-9 text-xs font-semibold rounded-full gap-1.5"
            >
              <Users className="size-3.5" /> Shared Rooms &amp; Flatmates
            </Button>

            <Button
              variant={kindFilter === "owner_flat" ? "default" : "outline"}
              size="sm"
              onClick={() => setKindFilter("owner_flat")}
              className="h-9 text-xs font-semibold rounded-full gap-1.5"
            >
              <Home className="size-3.5" /> Direct Owner Flats
            </Button>
          </div>

          <Button asChild size="sm" variant="outline" className="h-9 text-xs font-semibold gap-1.5 border-primary/30 text-primary hover:bg-primary/5">
            <Link href="/direct/new">
              <PlusCircle className="size-4" /> List Room or Flat
            </Link>
          </Button>
        </div>

        {/* Secondary Filter Chips (Area & Gender) */}
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
          {/* Areas */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-muted-foreground font-medium mr-1">Area:</span>
            {areas.map((a) => (
              <button
                key={a}
                onClick={() => setAreaFilter(a)}
                className={`rounded-full px-2.5 py-1 transition capitalize ${
                  areaFilter === a
                    ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 font-semibold"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                }`}
              >
                {a === "all" ? "All Pune" : a}
              </button>
            ))}
          </div>

          {/* Gender Preference */}
          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground font-medium mr-1">Preference:</span>
            <button
              onClick={() => setGenderFilter("all")}
              className={`rounded-full px-2.5 py-1 transition ${
                genderFilter === "all"
                  ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 font-semibold"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              Any
            </button>
            <button
              onClick={() => setGenderFilter("female_only")}
              className={`rounded-full px-2.5 py-1 transition ${
                genderFilter === "female_only"
                  ? "bg-purple-600 text-white font-semibold"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              Female Only
            </button>
            <button
              onClick={() => setGenderFilter("male_only")}
              className={`rounded-full px-2.5 py-1 transition ${
                genderFilter === "male_only"
                  ? "bg-indigo-600 text-white font-semibold"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              Male Only
            </button>
          </div>
        </div>
      </div>

      {/* Grid of Direct Listings */}
      {listings.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-12 text-center space-y-3">
          <p className="text-base font-semibold text-foreground">No listings match this filter</p>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            Try resetting your area or gender preference to view all available verified direct listings.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setKindFilter("all");
              setAreaFilter("all");
              setGenderFilter("all");
            }}
          >
            Clear Filters
          </Button>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {listings.map((item) => (
            <DirectListingCard
              key={item.id}
              listing={item}
              isVerified={Boolean(verifiedUser)}
              onConnectClick={handleConnectClick}
            />
          ))}
        </div>
      )}

      {/* Modals */}
      <VerificationModal
        isOpen={isVerifying}
        onClose={() => setIsVerifying(false)}
        onVerified={handleVerified}
      />

      <ConnectModal
        listing={activeListingToConnect && verifiedUser ? activeListingToConnect : null}
        onClose={() => setActiveListingToConnect(null)}
      />
    </div>
  );
}
