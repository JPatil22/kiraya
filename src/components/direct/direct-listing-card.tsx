"use client";

import { useState } from "react";
import Link from "next/link";
import {
  BadgeCheck,
  Building2,
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
import { formatINR } from "@/lib/utils";
import type { DirectListing } from "@/lib/direct";

interface DirectListingCardProps {
  listing: DirectListing;
  isVerified: boolean;
  onConnectClick: (listing: DirectListing) => void;
}

export function DirectListingCard({
  listing,
  isVerified,
  onConnectClick,
}: DirectListingCardProps) {
  const isSharedRoom = listing.kind === "shared_room";
  const poster = isSharedRoom ? listing.flatmate : listing.owner;

  return (
    <div className="group flex flex-col overflow-hidden rounded-2xl border border-border/80 bg-card shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-primary/30 hover:shadow-xl">
      {/* Cover Photo & Badges */}
      <div className="relative aspect-[16/10] overflow-hidden bg-muted">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={listing.photos[0]}
          alt={listing.title}
          loading="lazy"
          className="size-full object-cover transition duration-500 group-hover:scale-105"
        />

        {/* Gradient Scrim */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

        {/* Top Badges */}
        <div className="absolute left-3 top-3 flex flex-wrap items-center gap-2">
          <Badge className="bg-emerald-600 text-white font-semibold shadow-sm border-0 text-[11px] px-2.5 py-0.5">
            <ShieldCheck className="mr-1 size-3.5" /> ₹0 Brokerage
          </Badge>

          {isSharedRoom ? (
            <Badge variant="secondary" className="bg-black/60 text-white backdrop-blur-md border-white/20 text-[11px]">
              <Users className="mr-1 size-3" /> Shared Flat
            </Badge>
          ) : (
            <Badge variant="secondary" className="bg-black/60 text-white backdrop-blur-md border-white/20 text-[11px]">
              <Home className="mr-1 size-3.5" /> Entire Flat
            </Badge>
          )}
        </div>

        {/* Price Tag Overlay */}
        <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between">
          <div className="text-white drop-shadow-sm">
            <span className="text-2xl font-bold tracking-tight">
              {formatINR(listing.rentMonthly)}
            </span>
            <span className="text-xs font-medium text-white/80">/mo split</span>
            <p className="text-[11px] text-white/70">
              Deposit: {formatINR(listing.deposit)} · No commission
            </p>
          </div>

          <Badge variant="outline" className="bg-black/50 text-white/90 border-white/20 text-[11px]">
            {listing.area}
          </Badge>
        </div>
      </div>

      {/* Card Body */}
      <div className="flex flex-1 flex-col p-5 space-y-4">
        <div>
          <Link href={`/direct/${listing.id}`} className="hover:underline">
            <h3 className="font-bold text-base leading-snug tracking-tight text-foreground line-clamp-2">
              {listing.title}
            </h3>
          </Link>

          <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
            <MapPin className="size-3.5 shrink-0 text-primary" />
            <span className="font-semibold text-foreground">{listing.society}</span>, {listing.area}
          </p>
        </div>

        {/* The Human / Verified Poster Block (Roomvia Style) */}
        {poster ? (
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 space-y-2">
            <div className="flex items-center gap-2.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={poster.avatarUrl}
                alt={poster.name}
                className="size-9 rounded-full object-cover border border-primary/30"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1">
                  <span className="font-semibold text-xs text-foreground truncate">
                    {poster.name}
                  </span>
                  <BadgeCheck className="size-3.5 text-primary shrink-0" />
                </div>
                <p className="text-[11px] text-muted-foreground truncate">
                  {"company" in poster
                    ? `${poster.designation} at ${poster.company}`
                    : poster.profession ?? "Verified Direct Owner"}
                </p>
              </div>
            </div>

            {/* Verification Chip */}
            <div className="flex items-center gap-1.5 pt-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
              <CheckCircle2 className="size-3.5 shrink-0" />
              <span>
                {"company" in poster
                  ? `Verified corporate email (@${poster.workEmailDomain})`
                  : poster.verificationDoc}
              </span>
            </div>
          </div>
        ) : null}

        {/* Lifestyle / House Vibe Chips (For Shared Rooms) */}
        {listing.flatmate ? (
          <div className="space-y-1.5 text-xs">
            <div className="flex flex-wrap gap-1.5">
              <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                <Laptop className="size-3" /> {listing.flatmate.workMode === "hybrid" ? "Hybrid" : listing.flatmate.workMode === "remote" ? "Remote" : "Office shift"}
              </span>
              <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                {listing.flatmate.habits.smoking === "non_smoker" ? "Non-smoker" : "Smoker"}
              </span>
              <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                {listing.flatmate.habits.food === "pure_veg" ? "Pure Veg" : "Non-veg OK"}
              </span>
            </div>

            <p className="text-[11px] text-muted-foreground italic line-clamp-2 pt-0.5">
              &ldquo;{listing.flatmate.bio}&rdquo;
            </p>
          </div>
        ) : (
          /* Direct Owner Preference */
          <div className="space-y-1 text-xs">
            <span className="text-[11px] font-medium text-muted-foreground">
              Owner Preference:
            </span>
            <p className="text-[12px] font-semibold text-foreground">
              Working corporate professionals or families only.
            </p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="pt-2 mt-auto flex items-center gap-2">
          <Button
            onClick={() => onConnectClick(listing)}
            size="sm"
            className="flex-1 font-semibold text-xs h-9 bg-primary hover:bg-primary/90 text-primary-foreground gap-1.5 shadow-sm"
          >
            {isVerified ? (
              <>
                <Phone className="size-3.5" /> Call / WhatsApp
              </>
            ) : (
              <>
                <ShieldCheck className="size-3.5" /> Connect with {isSharedRoom ? "Flatmate" : "Owner"}
              </>
            )}
          </Button>

          <Button asChild variant="outline" size="sm" className="h-9 px-3 text-xs">
            <Link href={`/direct/${listing.id}`}>Details</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
