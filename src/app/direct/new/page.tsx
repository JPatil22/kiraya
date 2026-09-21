"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Building,
  CheckCircle2,
  Home,
  ShieldCheck,
  Sparkles,
  Upload,
  Users,
} from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export default function NewDirectListingPage() {
  const [track, setTrack] = useState<"flatmate" | "owner">("flatmate");
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  return (
    <div className="relative min-h-dvh overflow-hidden bg-background">
      <SiteHeader />

      <main className="relative mx-auto max-w-3xl space-y-6 px-6 py-10">
        <div>
          <Button asChild variant="ghost" size="sm" className="-ml-3 hover:bg-primary/5">
            <Link href="/direct" className="gap-1.5 font-medium">
              <ArrowLeft className="size-4" /> All Direct Listings
            </Link>
          </Button>
        </div>

        {submitted ? (
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-8 text-center space-y-4">
            <div className="flex size-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 mx-auto">
              <CheckCircle2 className="size-6" />
            </div>
            <h2 className="text-2xl font-bold text-foreground">
              Listing Submitted for Direct Verification!
            </h2>
            <p className="text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
              We&apos;ll verify your corporate employment or property ownership within 2 business hours. Once verified, it will be published with the <strong>Zero Brokerage badge</strong>.
            </p>
            <div className="pt-2">
              <Button asChild>
                <Link href="/direct">Back to Direct Listings</Link>
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400 mb-2">
                <ShieldCheck className="size-3.5" /> Direct Community · Strictly 0 Brokerage
              </div>
              <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl text-foreground">
                List a Room or Flat Directly
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                No brokers allowed. Reach verified IT and corporate professionals across Pune tech hubs.
              </p>
            </div>

            {/* Select Track */}
            <div className="grid grid-cols-2 gap-3 p-1 rounded-2xl bg-muted text-xs font-medium">
              <button
                type="button"
                onClick={() => setTrack("flatmate")}
                className={`flex flex-col items-center justify-center gap-1.5 py-4 px-3 rounded-xl transition ${
                  track === "flatmate"
                    ? "bg-card text-foreground font-bold shadow-sm border border-border/80"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Users className="size-5 text-primary" />
                <span className="text-sm">Room in Shared Flat</span>
                <span className="text-[11px] font-normal text-muted-foreground text-center">
                  I currently live here &amp; need a flatmate
                </span>
              </button>

              <button
                type="button"
                onClick={() => setTrack("owner")}
                className={`flex flex-col items-center justify-center gap-1.5 py-4 px-3 rounded-xl transition ${
                  track === "owner"
                    ? "bg-card text-foreground font-bold shadow-sm border border-border/80"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Home className="size-5 text-emerald-600" />
                <span className="text-sm">Direct Owner Flat</span>
                <span className="text-[11px] font-normal text-muted-foreground text-center">
                  I own this flat and want working professionals
                </span>
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="rounded-2xl border border-border/80 bg-card p-6 shadow-sm space-y-4">
              <div>
                <Label htmlFor="title" className="text-xs font-semibold">Title of your listing</Label>
                <Input
                  id="title"
                  required
                  placeholder={
                    track === "flatmate"
                      ? "e.g. Master Bedroom with Attached Bath in 3BHK Wakad"
                      : "e.g. Direct Owner: Fully Furnished 2BHK in Hinjewadi Phase 1"
                  }
                  className="mt-1"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="society" className="text-xs font-semibold">Society / Building Name</Label>
                  <Input id="society" required placeholder="e.g. Mont Vert One, Amanora, Megapolis" className="mt-1" />
                </div>
                <div>
                  <Label htmlFor="area" className="text-xs font-semibold">Area / Neighbourhood</Label>
                  <Input id="area" required placeholder="e.g. Wakad, Baner, Hinjewadi, Kharadi" className="mt-1" />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="rent" className="text-xs font-semibold">
                    {track === "flatmate" ? "Monthly Rent Split (₹)" : "Monthly Rent (₹)"}
                  </Label>
                  <Input id="rent" type="number" required placeholder="e.g. 14000" className="mt-1" />
                </div>
                <div>
                  <Label htmlFor="deposit" className="text-xs font-semibold">Security Deposit (₹)</Label>
                  <Input id="deposit" type="number" required placeholder="e.g. 30000" className="mt-1" />
                </div>
              </div>

              <div>
                <Label htmlFor="work" className="text-xs font-semibold">
                  {track === "flatmate"
                    ? "Your Company & Role (e.g. SDE at Barclays)"
                    : "Your Profession (e.g. Architect, Tech Advisor)"}
                </Label>
                <Input id="work" required placeholder="e.g. Barclays, Google, Tech Mahindra" className="mt-1" />
              </div>

              <div>
                <Label htmlFor="desc" className="text-xs font-semibold">Description &amp; House Vibe</Label>
                <Textarea
                  id="desc"
                  required
                  rows={4}
                  placeholder={
                    track === "flatmate"
                      ? "Tell potential flatmates about the room, flat amenities, daily routine, cook/maid setup, and what kind of flatmate you're looking for..."
                      : "Describe your flat, furnishings, society amenities, and your tenant requirements (e.g. IT professionals only)..."
                  }
                  className="mt-1 text-sm"
                />
              </div>

              <div>
                <Label htmlFor="phone" className="text-xs font-semibold">Your WhatsApp / Phone Number</Label>
                <Input id="phone" required placeholder="+91 98XXXXXXXX" className="mt-1" />
                <p className="text-[11px] text-muted-foreground mt-1">
                  Protected: Only revealed to verified working professionals who pass the LinkedIn/work email gate.
                </p>
              </div>

              <div className="pt-2">
                <Button type="submit" className="w-full h-11 font-bold text-sm bg-primary hover:bg-primary/90">
                  Submit for Direct Verification
                </Button>
              </div>
            </form>
          </div>
        )}
      </main>
    </div>
  );
}
