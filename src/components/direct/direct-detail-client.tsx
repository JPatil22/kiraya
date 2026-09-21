"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  BadgeCheck,
  Building,
  Calendar,
  CheckCircle2,
  Clock,
  Heart,
  Home,
  Laptop,
  MapPin,
  MessageSquare,
  Phone,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { VerificationModal, type VerifiedUser } from "./verification-modal";
import { ConnectModal } from "./connect-modal";
import { formatINR } from "@/lib/utils";
import type { DirectListing } from "@/lib/direct";

export function DirectDetailClient({ listing }: { listing: DirectListing }) {
  const [verifiedUser, setVerifiedUser] = useState<VerifiedUser | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

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
    setIsConnecting(true);
  };

  const handleConnectClick = () => {
    if (!verifiedUser) {
      setIsVerifying(true);
    } else {
      setIsConnecting(true);
    }
  };

  const isSharedRoom = listing.kind === "shared_room";
  const poster = isSharedRoom ? listing.flatmate : listing.owner;

  return (
    <div className="space-y-8">
      {/* Back button */}
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-3 hover:bg-primary/5">
          <Link href="/direct" className="gap-1.5 font-medium">
            <ArrowLeft className="size-4" /> All Direct Listings
          </Link>
        </Button>
      </div>

      {/* Header / Badges */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge className="bg-emerald-600 text-white font-semibold">
            <ShieldCheck className="mr-1 size-3.5" /> ₹0 Brokerage
          </Badge>
          <Badge variant="outline" className="border-primary/30 text-primary font-medium">
            {isSharedRoom ? "Shared Flat / Private Room" : "Direct Owner Flat"}
          </Badge>
          <Badge variant="secondary">
            {listing.genderPreference === "female_only"
              ? "Female Flatmates Only"
              : listing.genderPreference === "male_only"
              ? "Male Flatmates Only"
              : "Any Working Professional"}
          </Badge>
        </div>

        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl lg:text-4xl text-foreground">
          {listing.title}
        </h1>

        <p className="flex items-center gap-1.5 text-sm text-muted-foreground font-medium">
          <MapPin className="size-4 text-primary" />
          <span>{listing.society}</span> · <span>{listing.area}, {listing.locality}</span>
        </p>
      </div>

      {/* Photo Gallery */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 rounded-2xl overflow-hidden border border-border/80 bg-muted/30 p-2">
        <div className="md:col-span-2 relative aspect-[16/10] overflow-hidden rounded-xl">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={listing.photos[0]}
            alt={listing.title}
            className="size-full object-cover"
          />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-1 gap-4">
          {listing.photos.slice(1, 3).map((photo, i) => (
            <div key={i} className="relative aspect-[16/10] md:aspect-auto md:h-full overflow-hidden rounded-xl">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo}
                alt=""
                className="size-full object-cover"
              />
            </div>
          ))}
        </div>
      </div>

      {/* 2-Column Split: Content & Sticky Contact Sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column (8 cols) */}
        <div className="lg:col-span-8 space-y-6">
          {/* Verified Host / Flatmate Card (Roomvia Style) */}
          {poster ? (
            <div className="rounded-2xl border border-primary/20 bg-primary/5 p-6 space-y-4">
              <div className="flex items-start gap-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={poster.avatarUrl}
                  alt={poster.name}
                  className="size-16 rounded-full object-cover border-2 border-primary/30 shadow-md"
                />
                <div className="space-y-1 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-lg text-foreground">{poster.name}</h3>
                    <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 text-xs">
                      <BadgeCheck className="mr-1 size-3.5" /> Verified
                    </Badge>
                  </div>
                  <p className="text-sm font-medium text-foreground/80">
                    {"company" in poster
                      ? `${poster.designation} at ${poster.company}`
                      : poster.profession ?? "Property Owner"}
                  </p>
                  <p className="text-xs text-emerald-700 dark:text-emerald-400">
                    {"company" in poster
                      ? `✓ Corporate email verified (@${poster.workEmailDomain}) · LinkedIn verified`
                      : `✓ ${poster.verificationDoc}`}
                  </p>
                </div>
              </div>

              {/* Bio */}
              <p className="text-sm leading-relaxed text-foreground/90 italic bg-card/60 rounded-xl p-4 border border-border/40">
                &ldquo;{poster.bio}&rdquo;
              </p>

              {/* Habits / Routine for Flatmates */}
              {"habits" in poster ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2 text-xs">
                  <div className="rounded-xl border border-border/60 bg-card p-3 space-y-1">
                    <span className="text-muted-foreground font-medium">Work Routine:</span>
                    <p className="font-semibold text-foreground">{poster.habits.routine}</p>
                  </div>
                  <div className="rounded-xl border border-border/60 bg-card p-3 space-y-1">
                    <span className="text-muted-foreground font-medium">Social Vibe:</span>
                    <p className="font-semibold text-foreground">{poster.habits.socialVibe}</p>
                  </div>
                  <div className="rounded-xl border border-border/60 bg-card p-3 space-y-1">
                    <span className="text-muted-foreground font-medium">Food &amp; Kitchen:</span>
                    <p className="font-semibold text-foreground capitalize">
                      {poster.habits.food.replace(/_/g, " ")}
                    </p>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          {/* Description */}
          <div className="rounded-2xl border border-border/80 bg-card p-6 space-y-3 shadow-sm">
            <h3 className="font-bold text-base text-foreground">About the property &amp; setup</h3>
            <p className="text-sm leading-relaxed text-muted-foreground whitespace-pre-line">
              {listing.description}
            </p>
          </div>

          {/* House Rules */}
          <div className="rounded-2xl border border-border/80 bg-card p-6 space-y-3 shadow-sm">
            <h3 className="font-bold text-base text-foreground">House Rules &amp; Preferences</h3>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-foreground/90">
              {listing.houseRules.map((rule, idx) => (
                <li key={idx} className="flex items-center gap-2">
                  <CheckCircle2 className="size-4 text-primary shrink-0" />
                  <span>{rule}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Amenities */}
          <div className="rounded-2xl border border-border/80 bg-card p-6 space-y-3 shadow-sm">
            <h3 className="font-bold text-base text-foreground">Features &amp; Amenities</h3>
            <div className="flex flex-wrap gap-2">
              {listing.amenities.map((item, idx) => (
                <span
                  key={idx}
                  className="rounded-lg bg-muted px-3 py-1.5 text-xs font-medium text-foreground"
                >
                  {item}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Right Sticky Sidebar (4 cols) */}
        <div className="lg:col-span-4 sticky top-24 space-y-4">
          <div className="rounded-2xl border border-border/80 bg-card p-6 shadow-md space-y-5">
            <div>
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Monthly Rent Split
              </span>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-3xl font-extrabold tracking-tight text-foreground">
                  {formatINR(listing.rentMonthly)}
                </span>
                <span className="text-sm text-muted-foreground">/month</span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Deposit: <span className="font-semibold text-foreground">{formatINR(listing.deposit)}</span> · 100% refundable
              </p>
            </div>

            <div className="space-y-2 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-xs">
              <div className="flex items-center justify-between font-semibold text-emerald-700 dark:text-emerald-400">
                <span>Brokerage:</span>
                <span>₹0 (Zero Brokerage)</span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Deal directly with the verified {isSharedRoom ? "flatmate" : "owner"}.
              </p>
            </div>

            {/* Action button */}
            <Button
              onClick={handleConnectClick}
              className="w-full h-11 font-bold text-sm bg-primary hover:bg-primary/90 text-primary-foreground shadow-md gap-2"
            >
              {verifiedUser ? (
                <>
                  <Phone className="size-4" /> Call / Chat Directly
                </>
              ) : (
                <>
                  <ShieldCheck className="size-4" /> Connect with {isSharedRoom ? "Flatmate" : "Owner"}
                </>
              )}
            </Button>

            {!verifiedUser ? (
              <p className="text-center text-[11px] text-muted-foreground">
                Requires 1-click LinkedIn or Corporate Email verification.
              </p>
            ) : null}
          </div>
        </div>
      </div>

      {/* Modals */}
      <VerificationModal
        isOpen={isVerifying}
        onClose={() => setIsVerifying(false)}
        onVerified={handleVerified}
      />

      <ConnectModal
        listing={isConnecting && verifiedUser ? listing : null}
        onClose={() => setIsConnecting(false)}
      />
    </div>
  );
}
