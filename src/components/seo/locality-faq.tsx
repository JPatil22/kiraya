"use client";

import { useState } from "react";
import { ChevronDown, HelpCircle, ShieldCheck, Sparkles, TrendingUp, Wallet } from "lucide-react";
import { formatINR } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

interface LocalityFaqProps {
  areaName: string;
  avgRent: number;
  minRent: number;
  maxRent: number;
  avgDeposit: number;
  totalListings: number;
  zone?: string | null;
}

export function LocalityFaq({
  areaName,
  avgRent,
  minRent,
  maxRent,
  avgDeposit,
  totalListings,
  zone,
}: LocalityFaqProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const faqs = [
    {
      question: `What is the average rent for flats in ${areaName}, Pune?`,
      answer: `The average monthly rent for flats in ${areaName} is approximately ${formatINR(avgRent)}/month. Prices typically range from ${formatINR(minRent)} for budget configurations to ${formatINR(maxRent)} for premium 3 BHK or fully furnished apartments.`,
      icon: TrendingUp,
    },
    {
      question: `Are there zero brokerage rental flats in ${areaName}?`,
      answer: `Yes! Kiraya lists verified direct-owner properties in ${areaName} with ₹0 brokerage fees, 100% itemized cost breakdowns (rent, maintenance, deposit), and physically verified photos.`,
      icon: ShieldCheck,
    },
    {
      question: `What is the typical security deposit for a flat in ${areaName}?`,
      answer: `The median security deposit for rental homes in ${areaName} is approximately ${formatINR(avgDeposit)}. In Pune, security deposits typically equal 2 to 3 months of monthly rent and are explicitly stated before you visit.`,
      icon: Wallet,
    },
    {
      question: `How does Kiraya verify listings in ${areaName}?`,
      answer: `Every property listing in ${areaName} includes physical verification timestamps, room-by-room photo coverage, and direct owner identity confirmations to eliminate ghost listings and fake photos.`,
      icon: Sparkles,
    },
  ];

  return (
    <section className="rounded-3xl border border-border/80 bg-gradient-to-br from-card via-card/95 to-muted/20 p-6 sm:p-8 shadow-sm space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/60 pb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary font-semibold text-xs gap-1">
              <HelpCircle className="size-3.5" />
              Locality Guide & FAQs
            </Badge>
            {zone ? (
              <Badge variant="secondary" className="text-xs font-medium">
                {zone} Pune
              </Badge>
            ) : null}
          </div>
          <h2 className="text-2xl font-extrabold tracking-tight text-foreground">
            Renting in {areaName}: Frequently Asked Questions
          </h2>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Essential rental insights and price benchmarks for tenants looking for homes in {areaName}.
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {faqs.map((faq, idx) => {
          const isOpen = openIndex === idx;
          const Icon = faq.icon;

          return (
            <div
              key={idx}
              className="overflow-hidden rounded-2xl border border-border/70 bg-card/80 transition-all duration-200 hover:border-primary/40 shadow-2xs"
            >
              <button
                type="button"
                onClick={() => setOpenIndex(isOpen ? null : idx)}
                className="flex w-full items-center justify-between p-4 text-left font-semibold text-foreground hover:bg-muted/30 transition-colors gap-3"
              >
                <span className="flex items-center gap-3 text-sm sm:text-base">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Icon className="size-4" />
                  </span>
                  <span>{faq.question}</span>
                </span>
                <ChevronDown
                  className={`size-4 shrink-0 text-muted-foreground transition-transform duration-200 ${
                    isOpen ? "rotate-180 text-primary" : ""
                  }`}
                />
              </button>

              {isOpen ? (
                <div className="px-4 pb-4 pt-1 text-xs sm:text-sm text-muted-foreground leading-relaxed border-t border-border/40 pl-15 bg-muted/10">
                  {faq.answer}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}
