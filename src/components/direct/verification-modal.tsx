"use client";

import { useState } from "react";
import {
  Briefcase,
  CheckCircle2,
  ExternalLink,
  Linkedin,
  Lock,
  Mail,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface VerifiedUser {
  name: string;
  company: string;
  designation: string;
  method: "linkedin" | "work_email";
  workEmail?: string;
  verifiedAt: string;
}

interface VerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onVerified: (user: VerifiedUser) => void;
}

export function VerificationModal({
  isOpen,
  onClose,
  onVerified,
}: VerificationModalProps) {
  const [tab, setTab] = useState<"linkedin" | "work_email">("linkedin");

  // Work email state
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [designation, setDesignation] = useState("");
  const [step, setStep] = useState<"details" | "otp">("details");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleLinkedInConnect = () => {
    setLoading(true);
    // Simulate LinkedIn OAuth 1-click verification
    setTimeout(() => {
      setLoading(false);
      const user: VerifiedUser = {
        name: "Alex Roberts",
        company: "Barclays Technology",
        designation: "Software Engineer",
        method: "linkedin",
        verifiedAt: new Date().toISOString(),
      };
      onVerified(user);
    }, 1200);
  };

  const handleSendOtp = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.includes("@") || email.endsWith("@gmail.com") || email.endsWith("@yahoo.com") || email.endsWith("@hotmail.com")) {
      setError("Please use your official corporate or university email address (e.g. @company.com, not public gmail/yahoo).");
      return;
    }
    if (!company.trim() || !designation.trim() || !name.trim()) {
      setError("Please fill in your name, company, and designation.");
      return;
    }
    setError(null);
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setStep("otp");
    }, 800);
  };

  const handleVerifyOtp = (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.length < 4) {
      setError("Please enter the 6-digit verification code sent to your email.");
      return;
    }
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      const user: VerifiedUser = {
        name,
        company,
        designation,
        method: "work_email",
        workEmail: email,
        verifiedAt: new Date().toISOString(),
      };
      onVerified(user);
    }, 1000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-up">
      <div className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-border/80 bg-card p-6 shadow-2xl transition-all">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label="Close"
        >
          <X className="size-4" />
        </button>

        {/* Security Badge Header */}
        <div className="flex items-center gap-2 mb-3">
          <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <ShieldCheck className="size-5" />
          </div>
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-primary">
              Verified Professional Community
            </span>
            <h2 className="text-xl font-bold tracking-tight text-foreground">
              Verify your professional profile
            </h2>
          </div>
        </div>

        <p className="text-[13px] leading-relaxed text-muted-foreground mb-6">
          To protect direct property owners and flatmates from brokers, spam calls, and unsolicited sales, this portal is strictly reserved for verified working professionals.
        </p>

        {/* Verification Options Tabs */}
        <div className="grid grid-cols-2 gap-2 p-1 mb-6 rounded-xl bg-muted text-xs font-medium">
          <button
            type="button"
            onClick={() => {
              setTab("linkedin");
              setError(null);
            }}
            className={`flex items-center justify-center gap-1.5 py-2 rounded-lg transition ${
              tab === "linkedin"
                ? "bg-card text-foreground font-semibold shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Linkedin className="size-3.5 text-[#0A66C2]" /> LinkedIn (Instant)
          </button>
          <button
            type="button"
            onClick={() => {
              setTab("work_email");
              setError(null);
            }}
            className={`flex items-center justify-center gap-1.5 py-2 rounded-lg transition ${
              tab === "work_email"
                ? "bg-card text-foreground font-semibold shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Mail className="size-3.5 text-primary" /> Corporate Email
          </button>
        </div>

        {/* Tab 1: LinkedIn Verification */}
        {tab === "linkedin" ? (
          <div className="space-y-4 text-center py-2">
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-left">
              <div className="flex items-start gap-3">
                <Linkedin className="size-6 text-[#0A66C2] shrink-0 mt-0.5" />
                <div className="text-xs space-y-1">
                  <p className="font-semibold text-foreground">1-Click Employment Verification</p>
                  <p className="text-muted-foreground leading-relaxed">
                    We securely verify your current employer &amp; job title. We will never post to your profile or message your connections.
                  </p>
                </div>
              </div>
            </div>

            <Button
              onClick={handleLinkedInConnect}
              disabled={loading}
              className="w-full h-11 bg-[#0A66C2] hover:bg-[#004182] text-white font-semibold gap-2 text-sm shadow-md"
            >
              {loading ? (
                <>Verifying LinkedIn profile...</>
              ) : (
                <>
                  <Linkedin className="size-4" /> Verify with LinkedIn
                </>
              )}
            </Button>

            <p className="text-[11px] text-muted-foreground">
              Unlocks direct contact numbers, owner WhatsApp, and flatmate chats.
            </p>
          </div>
        ) : (
          /* Tab 2: Corporate Email OTP */
          <div>
            {step === "details" ? (
              <form onSubmit={handleSendOtp} className="space-y-3.5">
                <div>
                  <Label htmlFor="pro-name" className="text-xs font-medium">Your Full Name</Label>
                  <Input
                    id="pro-name"
                    required
                    placeholder="e.g. Alex Roberts"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="mt-1 h-9 text-sm"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="pro-comp" className="text-xs font-medium">Employer / Company</Label>
                    <Input
                      id="pro-comp"
                      required
                      placeholder="e.g. Barclays, Google, TCS"
                      value={company}
                      onChange={(e) => setCompany(e.target.value)}
                      className="mt-1 h-9 text-sm"
                    />
                  </div>
                  <div>
                    <Label htmlFor="pro-desig" className="text-xs font-medium">Designation / Role</Label>
                    <Input
                      id="pro-desig"
                      required
                      placeholder="e.g. SDE, Product Manager"
                      value={designation}
                      onChange={(e) => setDesignation(e.target.value)}
                      className="mt-1 h-9 text-sm"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="pro-email" className="text-xs font-medium">
                    Corporate Work Email <span className="text-muted-foreground font-normal">(no Gmail/Yahoo)</span>
                  </Label>
                  <Input
                    id="pro-email"
                    type="email"
                    required
                    placeholder="name@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="mt-1 h-9 text-sm"
                  />
                </div>

                {error ? (
                  <p className="text-xs font-medium text-destructive">{error}</p>
                ) : null}

                <Button type="submit" disabled={loading} className="w-full h-10 font-semibold text-sm mt-2">
                  {loading ? "Sending verification code..." : "Send Verification Code"}
                </Button>
              </form>
            ) : (
              <form onSubmit={handleVerifyOtp} className="space-y-4 py-1 text-center">
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-foreground">Check your work inbox</p>
                  <p className="text-xs text-muted-foreground">
                    We sent a 6-digit verification code to <span className="font-semibold text-foreground">{email}</span>
                  </p>
                </div>

                <div className="max-w-xs mx-auto">
                  <Input
                    type="text"
                    maxLength={6}
                    placeholder="Enter 6-digit OTP (e.g. 123456)"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    className="text-center tracking-widest text-lg font-bold h-11"
                    autoFocus
                  />
                </div>

                {error ? (
                  <p className="text-xs font-medium text-destructive">{error}</p>
                ) : null}

                <div className="flex gap-2 justify-center">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setStep("details")}
                    className="text-xs text-muted-foreground"
                  >
                    Back
                  </Button>
                  <Button type="submit" disabled={loading} size="sm" className="font-semibold px-6">
                    {loading ? "Verifying..." : "Verify & Unlock"}
                  </Button>
                </div>

                <p className="text-[11px] text-muted-foreground">
                  (Demo tip: enter any 6 digits to verify instantly)
                </p>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
