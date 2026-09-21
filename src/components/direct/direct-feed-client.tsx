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
import {
  INITIAL_DIRECT_LISTINGS,
  getDirectListings,
  type DirectListing,
  type GenderPreference,
} from "@/lib/direct";

export function DirectFeedClient() {
  const [kindFilter, setKindFilter] = useState<"all" | "owner_flat" | "shared_room">("all");
  const [areaFilter, setAreaFilter] = useState<string>("all");
  const [genderFilter, setGenderFilter] = useState<GenderPreference | "all">("all");

  const [verifiedUser, setVerifiedUser] = useState<VerifiedUser | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [activeListingToConnect, setActiveListingToConnect] = useState<DirectListing | null>(null);

  // Load verification from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem("kiraya_verified_pro");
      if (stored) {
        setVerifiedUser(JSON.parse(stored));
      }
    } catch (e) {
      console.error(e);
    }
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

  return (
    <div className="space-y-8">
      {/* Verification Status Banner */}
      <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 shadow-sm backdrop-blur-md">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <ShieldCheck className="size-5" />
            </div>
            <div>
              {verifiedUser ? (
                <div>
                  <div className="flex items-center gap-1.5 font-bold text-sm text-foreground">
                    <span>{verifiedUser.name}</span>
                    <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 text-[10px] py-0 px-1.5 font-medium">
                      ✓ Verified at {verifiedUser.company}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Verified via {verifiedUser.method === "linkedin" ? "LinkedIn" : "Corporate Email"} · All direct contact numbers unlocked
                  </p>
                </div>
              ) : (
                <div>
                  <p className="font-bold text-sm text-foreground">
                    Professional Verification Gate
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Direct owners &amp; flatmates require verified identity (LinkedIn / Work Email) to prevent broker spam.
                  </p>
                </div>
              )}
            </div>
          </div>

          <div>
            {verifiedUser ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setVerifiedUser(null);
                  localStorage.removeItem("kiraya_verified_pro");
                }}
                className="text-xs text-muted-foreground hover:text-foreground h-8"
              >
                Reset Verification
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={() => setIsVerifying(true)}
                className="h-8 gap-1.5 text-xs font-semibold shadow-sm"
              >
                <Linkedin className="size-3.5" /> 1-Click Verification
              </Button>
            )}
          </div>
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
