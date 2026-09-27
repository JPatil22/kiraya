"use client";

import { useEffect, useState } from "react";
import {
  Users,
  ShieldCheck,
  Building2,
  Sparkles,
  HeartHandshake,
  MapPin,
  Clock,
  CalendarCheck,
  Lock,
  Flame,
} from "lucide-react";
import { CountUp } from "@/components/count-up";
import { Badge } from "@/components/ui/badge";

const LAUNCH_MILESTONES = [
  {
    name: "Direct Listing Ingestion",
    locality: "Pune Locality Index",
    action: "Verification portal live for owner & broker listings",
    saved: "Fast intake active",
    time: "Day 1",
  },
  {
    name: "Date-Stamped Photo Verification",
    locality: "Baner & Kothrud",
    action: "First batch of 6 listings verified room-by-room",
    saved: "100% photo integrity",
    time: "Day 2",
  },
  {
    name: "Privacy-First Contact Exchange",
    locality: "Viman Nagar & Kharadi",
    action: "Zero telemarketer phone leaks guaranteed",
    saved: "Zero spam calls",
    time: "Day 3",
  },
  {
    name: "Audit Trail & Mismatch Warnings",
    locality: "Hinjewadi & Paud Road",
    action: "Database triggers enabled for price edit tracking",
    saved: "Tamper-proof history",
    time: "Today (Day 4)",
  },
];

const TRUTHFUL_METRICS = [
  {
    icon: Building2,
    value: 6,
    prefix: "",
    suffix: "+",
    label: "Verified Homes Seeded",
    description: "Carefully checked listings across Baner, Kothrud, Viman Nagar & Kharadi.",
  },
  {
    icon: ShieldCheck,
    value: 100,
    prefix: "",
    suffix: "%",
    label: "Date-Stamped Photos",
    description: "Every photo carries its own capture date to stop 2-year-old reused pictures.",
  },
  {
    icon: Lock,
    value: 0,
    prefix: "",
    suffix: "",
    label: "Spam Phone Calls",
    description: "Your phone number is never broadcasted to telemarketers or public brokers.",
  },
  {
    icon: CalendarCheck,
    value: 7,
    prefix: "",
    suffix: " Days",
    label: "Freshness Window",
    description: "Listings automatically go stale if unconfirmed after 7 days.",
  },
];

export function PeopleHelpedSection() {
  return (
    <section className="relative overflow-hidden border-y border-border/80 bg-stone-900 text-stone-100 dark:bg-stone-950 py-16 sm:py-24">
      {/* Background radial glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(16,185,129,0.08),transparent_60%)]"
      />

      <div className="relative mx-auto max-w-6xl px-6">
        {/* Header pill */}
        <div className="flex flex-col items-center text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-1 text-xs font-semibold text-emerald-400 shadow-2xs backdrop-blur-xs">
            <Sparkles className="size-3.5 fill-emerald-400/30" />
            <span>Day 4 Launch Progress · Built for Truth</span>
          </div>

          <h2 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl lg:text-5xl text-stone-50">
            Building Pune's Honest Rental Index
          </h2>
          <p className="mt-3 max-w-2xl text-base sm:text-lg text-stone-300">
            We started 4 days ago with one goal: eliminate fake listings, blurred all-in prices, and broker spam in Pune — one verified flat at a time.
          </p>
        </div>

        {/* 4 Authentic Metric Cards */}
        <div className="mt-12 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {TRUTHFUL_METRICS.map((metric, i) => {
            const Icon = metric.icon;
            return (
              <div
                key={i}
                className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-stone-800 bg-stone-900/80 p-6 shadow-xl backdrop-blur-md transition-all duration-300 hover:-translate-y-1 hover:border-emerald-500/40 hover:bg-stone-800/80"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <div className="flex size-11 items-center justify-center rounded-xl border border-stone-700 bg-stone-800/80 text-emerald-400">
                      <Icon className="size-5" />
                    </div>
                    <span className="flex size-2 rounded-full bg-emerald-500 animate-pulse" />
                  </div>

                  <div className="mt-5 text-3xl sm:text-4xl font-black tracking-tight text-white tabular-nums">
                    {metric.prefix}
                    <CountUp to={metric.value} duration={1200} />
                    {metric.suffix}
                  </div>

                  <h3 className="mt-1 text-base font-bold text-stone-200">{metric.label}</h3>
                  <p className="mt-2 text-xs leading-relaxed text-stone-400">{metric.description}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Authentic Launch Timeline / Milestones */}
        <div className="mt-12 overflow-hidden rounded-2xl border border-stone-800 bg-stone-950/90 p-5 sm:p-6 shadow-2xl backdrop-blur-xl">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-800/80 pb-4">
            <div className="flex items-center gap-2">
              <span className="relative flex size-3">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex size-3 rounded-full bg-emerald-500" />
              </span>
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                Early Launch Timeline & Verification Log
              </span>
            </div>
            <span className="text-xs text-stone-400">Pune Locality Rollout</span>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
            {LAUNCH_MILESTONES.map((item, idx) => (
              <div
                key={idx}
                className="flex items-start gap-3.5 rounded-xl border border-stone-800/60 bg-stone-900/50 p-4 transition-all hover:border-stone-700 hover:bg-stone-900"
              >
                <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <HeartHandshake className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-sm text-stone-100 truncate">{item.name}</span>
                    <span className="text-[11px] text-stone-400 flex items-center gap-1 shrink-0">
                      <Clock className="size-3" />
                      {item.time}
                    </span>
                  </div>
                  <p className="text-xs text-emerald-400 font-medium mt-0.5">{item.action}</p>
                  <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-stone-400">
                    <span className="flex items-center gap-1">
                      <MapPin className="size-3 text-stone-500" />
                      {item.locality}
                    </span>
                    <Badge variant="outline" className="text-[10px] py-0 border-emerald-500/30 text-emerald-300 bg-emerald-500/10">
                      {item.saved}
                    </Badge>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
