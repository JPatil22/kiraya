"use client";

import { useState } from "react";
import Link from "next/link";
import { useActionState } from "react";
import {
  AlertTriangle,
  BadgeCheck,
  Camera,
  CameraOff,
  ExternalLink,
  Pencil,
  Shield,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { listingMaintenanceAction } from "@/app/admin/actions";

interface AdminListingBarProps {
  propertyId: string;
  photoCount: number;
  roomsCovered: number;
  roomsRequired: number;
  isStale?: boolean;
}

export function AdminListingBar({
  propertyId,
  photoCount,
  roomsCovered,
  roomsRequired,
  isStale,
}: AdminListingBarProps) {
  const [showConfirmTakedown, setShowConfirmTakedown] = useState(false);
  const [state, action, pending] = useActionState(listingMaintenanceAction, null);

  const hasNoPhotos = photoCount === 0;

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/95 p-4 text-slate-100 shadow-xl backdrop-blur-md transition-all">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Left: Badges & status info */}
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="inline-flex items-center gap-1.5 rounded-md bg-indigo-500/20 px-2.5 py-1 text-xs font-semibold text-indigo-300 border border-indigo-500/30">
            <Shield className="size-3.5 text-indigo-400" /> Admin Controls
          </span>

          {hasNoPhotos ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/15 px-3 py-1 text-xs font-semibold text-amber-300">
              <CameraOff className="size-3.5" /> No photos attached (0/{roomsRequired} rooms)
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-700 bg-slate-800/80 px-2.5 py-1 text-xs font-medium text-slate-300">
              <Camera className="size-3.5" /> {photoCount} photo{photoCount === 1 ? "" : "s"} ({roomsCovered}/{roomsRequired} rooms)
            </span>
          )}

          {isStale ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-400">
              Stale verification
            </span>
          ) : null}
        </div>

        {/* Right: Quick actions */}
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="outline" size="sm" className="h-8 border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700 hover:text-white">
            <Link href={`/listings/${propertyId}/photos`}>
              <Camera className="mr-1.5 size-3.5" /> Manage photos
            </Link>
          </Button>

          <Button asChild variant="outline" size="sm" className="h-8 border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700 hover:text-white">
            <Link href={`/listings/${propertyId}/edit`}>
              <Pencil className="mr-1.5 size-3.5" /> Edit listing
            </Link>
          </Button>

          <Button asChild variant="ghost" size="sm" className="h-8 text-slate-400 hover:bg-slate-800 hover:text-slate-200">
            <Link href="/admin/listings">
              <ExternalLink className="mr-1.5 size-3.5" /> Admin console
            </Link>
          </Button>

          {!showConfirmTakedown ? (
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={() => setShowConfirmTakedown(true)}
              className="h-8 bg-red-600 hover:bg-red-700 text-white font-medium shadow-sm"
            >
              <Trash2 className="mr-1.5 size-3.5" /> Delete listing
            </Button>
          ) : null}
        </div>
      </div>

      {/* Inline confirmation for Deletion */}
      {showConfirmTakedown ? (
        <form
          action={action}
          className="mt-3.5 rounded-xl border border-red-900/50 bg-red-950/40 p-3.5 text-sm transition-all"
        >
          <input type="hidden" name="propertyId" value={propertyId} />
          <input type="hidden" name="action" value="takedown" />
          <input type="hidden" name="redirectTo" value="/listings" />

          <div className="flex items-start gap-2.5">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-red-400" />
            <div className="flex-1 space-y-2">
              <p className="font-medium text-red-200">
                Confirm listing deletion
              </p>
              <p className="text-xs text-red-300/80">
                This will immediately delete this listing from search results, filters, and all public tenant feeds.
              </p>

              <div className="flex flex-wrap items-center gap-2 pt-1">
                <Input
                  name="note"
                  placeholder="Reason for deletion (optional, e.g. 'No photos', 'Wrong details')"
                  maxLength={500}
                  className="h-8 max-w-sm border-red-800/60 bg-red-950/60 text-xs text-white placeholder:text-red-300/50 focus-visible:ring-red-500"
                />

                <Button
                  type="submit"
                  variant="destructive"
                  size="sm"
                  disabled={pending}
                  className="h-8 bg-red-600 font-semibold text-white hover:bg-red-700"
                >
                  {pending ? "Deleting..." : "Confirm Delete"}
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowConfirmTakedown(false)}
                  disabled={pending}
                  className="h-8 text-slate-400 hover:bg-red-900/30 hover:text-slate-200"
                >
                  <X className="mr-1 size-3.5" /> Cancel
                </Button>
              </div>

              {state?.error ? (
                <p className="pt-1 text-xs font-semibold text-red-400">{state.error}</p>
              ) : null}
            </div>
          </div>
        </form>
      ) : null}
    </div>
  );
}
