"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Building2,
  CalendarCheck2,
  CheckCircle2,
  Clock,
  ExternalLink,
  Eye,
  FileCheck,
  Home,
  Info,
  KeyRound,
  Lock,
  Phone,
  ShieldCheck,
  Sparkles,
  UserCheck,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  type DirectAccessApplication,
  DIRECT_STORAGE_KEY,
  DIRECT_ACCESS_APPROVED_KEY,
  DIRECT_CURRENT_APP_KEY,
  getApplicationsFromStorage,
  saveApplicationsToStorage,
} from "@/lib/direct";

interface DirectGateCardProps {
  onApproved: () => void;
}

export function DirectGateCard({ onApproved }: DirectGateCardProps) {
  const [track, setTrack] = useState<"owner" | "professional">("owner");
  const [myApp, setMyApp] = useState<DirectAccessApplication | null>(null);

  // Owner Form State
  const [ownerLegalName, setOwnerLegalName] = useState("");
  const [ownerPhone, setOwnerPhone] = useState("");
  const [ownershipType, setOwnershipType] = useState<"primary_owner" | "legal_guardian_family">("primary_owner");
  const [guardianRelationship, setGuardianRelationship] = useState<"son" | "daughter" | "spouse" | "parent" | "poa_holder" | "other">("son");
  const [registeredOwnerName, setRegisteredOwnerName] = useState("");
  const [society, setSociety] = useState("");
  const [locality, setLocality] = useState("Wakad");
  const [unitDetails, setUnitDetails] = useState("");
  const [bhk, setBhk] = useState("2bhk");
  const [expectedRent, setExpectedRent] = useState("26000");
  const [preferredVisitSlot, setPreferredVisitSlot] = useState("Tomorrow 11:00 AM – 1:30 PM");
  const [tenantCriteria, setTenantCriteria] = useState("Corporate IT working professionals only · Clean habits");

  // Professional Form State
  const [proName, setProName] = useState("");
  const [proPhone, setProPhone] = useState("");
  const [proCompany, setProCompany] = useState("");
  const [proDesignation, setProDesignation] = useState("");
  const [proWorkEmail, setProWorkEmail] = useState("");
  const [proLinkedin, setProLinkedin] = useState("");

  // Load active application from localStorage
  useEffect(() => {
    try {
      const storedAppId = localStorage.getItem(DIRECT_CURRENT_APP_KEY);
      if (storedAppId) {
        const all = getApplicationsFromStorage();
        const found = all.find((a) => a.id === storedAppId);
        if (found) {
          setMyApp(found);
          if (found.status === "approved") {
            localStorage.setItem(DIRECT_ACCESS_APPROVED_KEY, "true");
            onApproved();
          }
        }
      }
    } catch (e) {
      console.error(e);
    }
  }, [onApproved]);

  const handleOwnerSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newApp: DirectAccessApplication = {
      id: `app-owner-${Date.now()}`,
      kind: "owner",
      name: ownerLegalName,
      phone: ownerPhone,
      status: "visit_scheduled",
      createdAt: new Date().toISOString(),
      ownershipType,
      guardianRelationship: ownershipType === "legal_guardian_family" ? guardianRelationship : undefined,
      registeredOwnerName: ownershipType === "legal_guardian_family" ? registeredOwnerName : ownerLegalName,
      society,
      unitDetails,
      bhk,
      expectedRent: Number(expectedRent) || 25000,
      tenantCriteria,
      preferredVisitSlot,
      checklist: {
        govtIdVerified: false,
        ownershipBillVerified: false,
        physicalPossessionVerified: false,
      },
    };

    const apps = getApplicationsFromStorage();
    const updated = [newApp, ...apps];
    saveApplicationsToStorage(updated);
    localStorage.setItem(DIRECT_CURRENT_APP_KEY, newApp.id);
    setMyApp(newApp);
  };

  const handleProSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newApp: DirectAccessApplication = {
      id: `app-pro-${Date.now()}`,
      kind: "professional",
      name: proName,
      phone: proPhone,
      status: "pending",
      createdAt: new Date().toISOString(),
      company: proCompany,
      designation: proDesignation,
      workEmail: proWorkEmail,
      linkedinUrl: proLinkedin,
      workMode: "hybrid",
    };

    const apps = getApplicationsFromStorage();
    const updated = [newApp, ...apps];
    saveApplicationsToStorage(updated);
    localStorage.setItem(DIRECT_CURRENT_APP_KEY, newApp.id);
    setMyApp(newApp);
  };

  const handleQuickApproveDemo = () => {
    if (myApp) {
      const apps = getApplicationsFromStorage();
      const updated = apps.map((a) => (a.id === myApp.id ? { ...a, status: "approved" as const } : a));
      saveApplicationsToStorage(updated);
      setMyApp({ ...myApp, status: "approved" });
    }
    localStorage.setItem(DIRECT_ACCESS_APPROVED_KEY, "true");
    onApproved();
  };

  const handleResetApplication = () => {
    localStorage.removeItem(DIRECT_CURRENT_APP_KEY);
    localStorage.removeItem(DIRECT_ACCESS_APPROVED_KEY);
    setMyApp(null);
  };

  // If application is submitted and under review:
  if (myApp) {
    return (
      <div className="mx-auto max-w-2xl rounded-3xl border border-border/80 bg-card/90 p-8 shadow-xl backdrop-blur-md text-center space-y-6">
        <div className="flex size-16 items-center justify-center rounded-2xl bg-primary/10 text-primary mx-auto shadow-inner">
          {myApp.kind === "owner" ? (
            <CalendarCheck2 className="size-8 text-emerald-600 dark:text-emerald-400" />
          ) : (
            <Clock className="size-8 text-primary" />
          )}
        </div>

        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
            <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
            {myApp.kind === "owner"
              ? "In-Person Inspection Scheduled · Under Legal Review"
              : "Corporate Profile Submitted · Under Review"}
          </div>

          <h2 className="text-2xl font-bold tracking-tight text-foreground">
            {myApp.kind === "owner"
              ? "Property & Legal Guardian Verification Pending"
              : "Application Received: Under Admin Review"}
          </h2>

          <p className="text-sm leading-relaxed text-muted-foreground max-w-lg mx-auto">
            {myApp.kind === "owner" ? (
              <>
                Our Kiraya verification team will visit your flat at <strong>{myApp.society}</strong> during your selected slot (<strong>{myApp.preferredVisitSlot}</strong>). We will verify your Government ID, cross-check the society maintenance bill, and take certified photos.
              </>
            ) : (
              <>
                Our team is reviewing your corporate credentials at <strong>{myApp.company}</strong> ({myApp.workEmail}). Access to direct owner contact numbers and flatmates is granted once approved.
              </>
            )}
          </p>
        </div>

        {/* Application details summary card */}
        <div className="rounded-2xl border border-border/70 bg-muted/40 p-4 text-left text-xs space-y-2">
          <div className="flex justify-between items-center py-1 border-b border-border/50">
            <span className="text-muted-foreground">Applicant Name:</span>
            <span className="font-semibold text-foreground">{myApp.name}</span>
          </div>
          <div className="flex justify-between items-center py-1 border-b border-border/50">
            <span className="text-muted-foreground">Contact Phone:</span>
            <span className="font-semibold text-foreground">{myApp.phone}</span>
          </div>

          {myApp.kind === "owner" ? (
            <>
              <div className="flex justify-between items-center py-1 border-b border-border/50">
                <span className="text-muted-foreground">Ownership Authority:</span>
                <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                  {myApp.ownershipType === "primary_owner"
                    ? "Registered Owner (Self)"
                    : `Legal Guardian / Family (${myApp.guardianRelationship})`}
                </span>
              </div>
              {myApp.registeredOwnerName && (
                <div className="flex justify-between items-center py-1 border-b border-border/50">
                  <span className="text-muted-foreground">On Record Owner:</span>
                  <span className="font-semibold text-foreground">{myApp.registeredOwnerName}</span>
                </div>
              )}
              <div className="flex justify-between items-center py-1 border-b border-border/50">
                <span className="text-muted-foreground">Society &amp; Unit:</span>
                <span className="font-semibold text-foreground">
                  {myApp.society} ({myApp.unitDetails || "Flat"})
                </span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-border/50">
                <span className="text-muted-foreground">Expected Rent:</span>
                <span className="font-semibold text-foreground">₹{myApp.expectedRent?.toLocaleString("en-IN")}/mo (₹0 Brokerage)</span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-muted-foreground">Physical Visit Slot:</span>
                <span className="font-semibold text-primary">{myApp.preferredVisitSlot}</span>
              </div>
            </>
          ) : (
            <>
              <div className="flex justify-between items-center py-1 border-b border-border/50">
                <span className="text-muted-foreground">Company &amp; Role:</span>
                <span className="font-semibold text-foreground">
                  {myApp.designation} at {myApp.company}
                </span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-border/50">
                <span className="text-muted-foreground">Corporate Email:</span>
                <span className="font-semibold text-foreground">{myApp.workEmail}</span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-muted-foreground">LinkedIn:</span>
                <span className="font-semibold text-primary truncate max-w-[200px]">{myApp.linkedinUrl}</span>
              </div>
            </>
          )}
        </div>

        {/* Action Buttons & Sandbox Demo Controls */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <Button asChild variant="outline" size="sm" className="w-full sm:w-auto">
            <Link href="/admin/direct-access" target="_blank">
              <Eye className="size-4 mr-1.5" /> Open Admin Review Cockpit
            </Link>
          </Button>

          <Button
            onClick={handleQuickApproveDemo}
            size="sm"
            className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
          >
            <Sparkles className="size-4 mr-1.5" /> Demo Quick-Approve (Unlock Portal)
          </Button>
        </div>

        <div className="pt-2">
          <button
            onClick={handleResetApplication}
            className="text-xs text-muted-foreground hover:text-foreground underline"
          >
            Cancel &amp; Submit Another Application
          </button>
        </div>
      </div>
    );
  }

  // Verification Application Form
  return (
    <div className="mx-auto max-w-3xl rounded-2xl border border-border/70 bg-card p-6 sm:p-8 shadow-xl space-y-6">
      {/* Header Explainer */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
          <Lock className="size-3" /> Closed High-Trust Community · ₹0 Brokerage
        </div>

        <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          Membership Clearance Required
        </h2>

        <p className="text-sm leading-relaxed text-muted-foreground max-w-lg mx-auto">
          To protect tenants and owners from broker spam, <strong>Kiraya Direct</strong> is gated. Owners are physically verified in-person; working professionals are verified via LinkedIn and work email.
        </p>
      </div>

      {/* 2-Track Toggle */}
      <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-muted/70 text-xs font-medium">
        <button
          type="button"
          onClick={() => setTrack("owner")}
          className={`flex flex-col sm:flex-row items-center justify-center gap-2 py-2.5 px-3 rounded-lg transition ${
            track === "owner"
              ? "bg-background text-foreground font-semibold shadow-xs border border-border/60"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Home className="size-4 text-emerald-600 shrink-0" />
          <div className="text-left">
            <span className="block text-xs font-semibold">Property Owner / Guardian</span>
            <span className="hidden sm:block text-[10px] text-muted-foreground">
              In-person physical verification
            </span>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setTrack("professional")}
          className={`flex flex-col sm:flex-row items-center justify-center gap-2 py-2.5 px-3 rounded-lg transition ${
            track === "professional"
              ? "bg-background text-foreground font-semibold shadow-xs border border-border/60"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <UserCheck className="size-4 text-primary shrink-0" />
          <div className="text-left">
            <span className="block text-xs font-semibold">Working Professional</span>
            <span className="hidden sm:block text-[10px] text-muted-foreground">
              Corporate email &amp; LinkedIn
            </span>
          </div>
        </button>
      </div>

      {/* Owner / Legal Guardian Form */}
      {track === "owner" && (
        <form onSubmit={handleOwnerSubmit} className="space-y-5 pt-1">
          {/* Trust Banner */}
          <div className="flex items-start gap-2.5 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3.5 text-xs text-muted-foreground">
            <ShieldCheck className="size-4 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-foreground">Zero Online Paperwork Friction:</span> No document uploads required. Our team inspects your flat, meets you or your guardian, and verifies the society bill during the visit.
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="owner-name" className="text-xs font-semibold">Your Full Legal Name *</Label>
              <Input
                id="owner-name"
                required
                value={ownerLegalName}
                onChange={(e) => setOwnerLegalName(e.target.value)}
                placeholder="e.g. Ramesh Patil / Ananya Deshmukh"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="owner-phone" className="text-xs font-semibold">WhatsApp / Phone Number *</Label>
              <Input
                id="owner-phone"
                required
                value={ownerPhone}
                onChange={(e) => setOwnerPhone(e.target.value)}
                placeholder="+91 98XXXXXXXX"
                className="mt-1"
              />
            </div>
          </div>

          {/* Legal Authority / Guardianship */}
          <div className="rounded-2xl border border-border/70 bg-muted/20 p-4 space-y-3">
            <Label className="text-xs font-bold uppercase tracking-wider text-foreground">
              Ownership Authority &amp; Legal Status *
            </Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition ${
                ownershipType === "primary_owner"
                  ? "border-emerald-500 bg-emerald-500/10 font-medium"
                  : "border-border/60 bg-card hover:border-border"
              }`}>
                <input
                  type="radio"
                  name="ownership"
                  checked={ownershipType === "primary_owner"}
                  onChange={() => setOwnershipType("primary_owner")}
                  className="size-4 text-emerald-600"
                />
                <span className="text-xs">
                  <strong>Registered Owner</strong> (Sole or Joint Owner on Record)
                </span>
              </label>

              <label className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition ${
                ownershipType === "legal_guardian_family"
                  ? "border-emerald-500 bg-emerald-500/10 font-medium"
                  : "border-border/60 bg-card hover:border-border"
              }`}>
                <input
                  type="radio"
                  name="ownership"
                  checked={ownershipType === "legal_guardian_family"}
                  onChange={() => setOwnershipType("legal_guardian_family")}
                  className="size-4 text-emerald-600"
                />
                <span className="text-xs">
                  <strong>Legal Guardian / Family Member</strong> (Managing for parents/relative/POA)
                </span>
              </label>
            </div>

            {/* If Guardian: Collect relationship */}
            {ownershipType === "legal_guardian_family" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-border/50">
                <div>
                  <Label htmlFor="guardian-rel" className="text-xs font-semibold">Your Relationship to Owner *</Label>
                  <select
                    id="guardian-rel"
                    value={guardianRelationship}
                    onChange={(e) => setGuardianRelationship(e.target.value as any)}
                    className="w-full mt-1 h-9 rounded-md border border-input bg-background px-3 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    <option value="son">Son (Managing for parents)</option>
                    <option value="daughter">Daughter (Managing for parents)</option>
                    <option value="spouse">Spouse</option>
                    <option value="parent">Parent (Managing for son/daughter)</option>
                    <option value="poa_holder">Power of Attorney (POA Holder)</option>
                    <option value="other">Authorized Family Member</option>
                  </select>
                </div>

                <div>
                  <Label htmlFor="owner-record" className="text-xs font-semibold">Registered Owner&apos;s Name on Record *</Label>
                  <Input
                    id="owner-record"
                    required
                    value={registeredOwnerName}
                    onChange={(e) => setRegisteredOwnerName(e.target.value)}
                    placeholder="e.g. Suresh & Malati Deshmukh"
                    className="mt-1"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Property Specifics */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="society-name" className="text-xs font-semibold">Society / Project *</Label>
              <Input
                id="society-name"
                required
                value={society}
                onChange={(e) => setSociety(e.target.value)}
                placeholder="e.g. Mont Vert One, Amanora"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="unit-num" className="text-xs font-semibold">Tower &amp; Flat No. *</Label>
              <Input
                id="unit-num"
                required
                value={unitDetails}
                onChange={(e) => setUnitDetails(e.target.value)}
                placeholder="e.g. Tower B, Flat 804"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="bhk-select" className="text-xs font-semibold">Configuration *</Label>
              <select
                id="bhk-select"
                value={bhk}
                onChange={(e) => setBhk(e.target.value)}
                className="w-full mt-1 h-9 rounded-md border border-input bg-background px-3 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="1bhk">1 BHK</option>
                <option value="2bhk">2 BHK</option>
                <option value="3bhk">3 BHK</option>
                <option value="4plus">4+ BHK / Villa</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="exp-rent" className="text-xs font-semibold">Expected Monthly Rent (₹) *</Label>
              <Input
                id="exp-rent"
                type="number"
                required
                value={expectedRent}
                onChange={(e) => setExpectedRent(e.target.value)}
                placeholder="e.g. 28000"
                className="mt-1"
              />
              <span className="text-[10px] text-emerald-600 font-semibold mt-0.5 block">
                Strictly ₹0 Brokerage for Tenants &amp; Owners
              </span>
            </div>

            <div>
              <Label htmlFor="visit-slot" className="text-xs font-semibold">
                Preferred In-Person Team Inspection Slot *
              </Label>
              <Input
                id="visit-slot"
                required
                value={preferredVisitSlot}
                onChange={(e) => setPreferredVisitSlot(e.target.value)}
                placeholder="e.g. Tomorrow 11 AM - 1 PM, or Weekend Evening"
                className="mt-1"
              />
              <span className="text-[10px] text-muted-foreground mt-0.5 block">
                Our field team visits in this window to verify ID &amp; flat keys.
              </span>
            </div>
          </div>

          <div>
            <Label htmlFor="tenant-req" className="text-xs font-semibold">Tenant Preferences / Rules</Label>
            <Input
              id="tenant-req"
              value={tenantCriteria}
              onChange={(e) => setTenantCriteria(e.target.value)}
              placeholder="e.g. Working IT/Corporate professionals only · Family or bachelors"
              className="mt-1"
            />
          </div>

          <Button type="submit" className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-md">
            Schedule Physical Visit &amp; Submit for Legal Review →
          </Button>
        </form>
      )}

      {/* Working Professional Form */}
      {track === "professional" && (
        <form onSubmit={handleProSubmit} className="space-y-6 pt-1">
          <div className="flex items-start gap-3 rounded-2xl border border-primary/30 bg-primary/5 p-4 text-xs text-muted-foreground">
            <Building2 className="size-5 text-primary shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-foreground">Verified Corporate Network:</span> To preserve a high-trust roomvia-style community, all tenants and flatmate seekers must verify their corporate identity via LinkedIn and corporate email. No brokers or disposable accounts permitted.
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="pro-name" className="text-xs font-semibold">Full Legal Name *</Label>
              <Input
                id="pro-name"
                required
                value={proName}
                onChange={(e) => setProName(e.target.value)}
                placeholder="e.g. Rohan Varma"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="pro-phone" className="text-xs font-semibold">WhatsApp / Phone Number *</Label>
              <Input
                id="pro-phone"
                required
                value={proPhone}
                onChange={(e) => setProPhone(e.target.value)}
                placeholder="+91 98XXXXXXXX"
                className="mt-1"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="pro-company" className="text-xs font-semibold">Current Employer / Company *</Label>
              <Input
                id="pro-company"
                required
                value={proCompany}
                onChange={(e) => setProCompany(e.target.value)}
                placeholder="e.g. Barclays, Google, Infosys, Capgemini"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="pro-role" className="text-xs font-semibold">Designation / Role *</Label>
              <Input
                id="pro-role"
                required
                value={proDesignation}
                onChange={(e) => setProDesignation(e.target.value)}
                placeholder="e.g. Senior Software Engineer, Risk Analyst"
                className="mt-1"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="pro-email" className="text-xs font-semibold">Corporate Work Email *</Label>
              <Input
                id="pro-email"
                type="email"
                required
                value={proWorkEmail}
                onChange={(e) => setProWorkEmail(e.target.value)}
                placeholder="name@company.com"
                className="mt-1"
              />
              <span className="text-[10px] text-muted-foreground mt-0.5 block">
                Must be an official company domain (@barclays, @tcs, etc.)
              </span>
            </div>

            <div>
              <Label htmlFor="pro-linkedin" className="text-xs font-semibold">LinkedIn Profile URL *</Label>
              <Input
                id="pro-linkedin"
                type="url"
                required
                value={proLinkedin}
                onChange={(e) => setProLinkedin(e.target.value)}
                placeholder="https://linkedin.com/in/username"
                className="mt-1"
              />
            </div>
          </div>

          <Button type="submit" className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-sm shadow-md">
            Submit Corporate Profile for Verification →
          </Button>
        </form>
      )}
    </div>
  );
}
