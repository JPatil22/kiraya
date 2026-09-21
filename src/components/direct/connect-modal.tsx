"use client";

import { CheckCircle2, MessageSquare, Phone, ShieldCheck, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { DirectListing } from "@/lib/direct";

interface ConnectModalProps {
  listing: DirectListing | null;
  onClose: () => void;
}

export function ConnectModal({ listing, onClose }: ConnectModalProps) {
  if (!listing) return null;

  const isSharedRoom = listing.kind === "shared_room";
  const contactName = isSharedRoom
    ? listing.flatmate?.name ?? "Flatmate"
    : listing.owner?.name ?? "Owner";

  const whatsappUrl = `https://wa.me/${listing.whatsapp}?text=${encodeURIComponent(
    `Hi ${contactName}, I found your listing for ${listing.title} on Kiraya Direct. I'm a verified working professional and would love to connect about visiting!`,
  )}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-up">
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-border/80 bg-card p-6 shadow-2xl transition-all">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label="Close"
        >
          <X className="size-4" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-2.5 mb-4">
          <div className="flex size-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600">
            <ShieldCheck className="size-5" />
          </div>
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-600">
              Verified Direct Connection
            </span>
            <h3 className="text-lg font-bold text-foreground">
              Contact {contactName}
            </h3>
          </div>
        </div>

        <div className="rounded-xl border border-border/60 bg-muted/50 p-4 space-y-2.5 mb-5 text-sm">
          <p className="font-semibold text-foreground text-xs">{listing.title}</p>
          <p className="text-xs text-muted-foreground">{listing.society}, {listing.area}</p>
          <div className="pt-1 flex items-center justify-between text-xs font-medium border-t border-border/40">
            <span className="text-muted-foreground">Monthly Rent Split:</span>
            <span className="font-bold text-foreground">₹{listing.rentMonthly.toLocaleString("en-IN")}/mo</span>
          </div>
          <div className="flex items-center justify-between text-xs font-medium">
            <span className="text-muted-foreground">Brokerage:</span>
            <span className="font-bold text-emerald-600">₹0 (Direct Only)</span>
          </div>
        </div>

        {/* Contact Actions */}
        <div className="space-y-3">
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full h-11 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm shadow-md transition"
          >
            <MessageSquare className="size-4" /> Chat on WhatsApp
          </a>

          <a
            href={`tel:${listing.phone}`}
            className="flex items-center justify-center gap-2 w-full h-11 rounded-xl border border-border/80 bg-background hover:bg-muted text-foreground font-semibold text-sm transition"
          >
            <Phone className="size-4 text-primary" /> Call {listing.phone}
          </a>
        </div>

        <div className="mt-5 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 text-[11px] text-muted-foreground space-y-1">
          <p className="font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
            <CheckCircle2 className="size-3.5" /> 100% Zero Brokerage Guarantee
          </p>
          <p>
            You are speaking directly with the verified flatmate or direct property owner. Never pay any commission to anyone.
          </p>
        </div>
      </div>
    </div>
  );
}
