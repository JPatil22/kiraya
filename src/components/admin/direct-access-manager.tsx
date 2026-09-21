"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Building2,
  CalendarCheck2,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileCheck2,
  Home,
  KeyRound,
  Lock,
  MessageSquare,
  Phone,
  RotateCcw,
  Search,
  ShieldCheck,
  Sparkles,
  UserCheck,
  Users,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  type DirectAccessApplication,
  type ApplicationStatus,
  type ApplicationKind,
  INITIAL_DIRECT_APPLICATIONS,
  getApplicationsFromStorage,
  saveApplicationsToStorage,
  DIRECT_ACCESS_APPROVED_KEY,
} from "@/lib/direct";

export function DirectAccessManager() {
  const [apps, setApps] = useState<DirectAccessApplication[]>([]);
  const [selectedKind, setSelectedKind] = useState<"all" | "owner" | "professional">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "approved" | "rejected">("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Load from localStorage on mount
  useEffect(() => {
    setApps(getApplicationsFromStorage());

    const handleSync = () => {
      setApps(getApplicationsFromStorage());
    };
    window.addEventListener("storage", handleSync);
    window.addEventListener("kiraya_direct_applications_updated", handleSync);
    return () => {
      window.removeEventListener("storage", handleSync);
      window.removeEventListener("kiraya_direct_applications_updated", handleSync);
    };
  }, []);

  const updateApp = (id: string, patch: Partial<DirectAccessApplication>) => {
    const updated = apps.map((a) => (a.id === id ? { ...a, ...patch } : a));
    setApps(updated);
    saveApplicationsToStorage(updated);
  };

  const handleApprove = (app: DirectAccessApplication) => {
    const patch: Partial<DirectAccessApplication> = {
      status: "approved",
      reviewedAt: new Date().toISOString(),
    };
    if (app.kind === "owner") {
      patch.checklist = {
        govtIdVerified: true,
        ownershipBillVerified: true,
        physicalPossessionVerified: true,
      };
    }
    updateApp(app.id, patch);
    // Also approve access key for local session testing
    localStorage.setItem(DIRECT_ACCESS_APPROVED_KEY, "true");
  };

  const handleReject = (id: string) => {
    const reason = window.prompt("Enter rejection / follow-up reason:", "Incomplete legal credentials or unverified entity");
    if (reason) {
      updateApp(id, {
        status: "rejected",
        rejectionReason: reason,
        reviewedAt: new Date().toISOString(),
      });
    }
  };

  const handleToggleChecklist = (
    id: string,
    key: "govtIdVerified" | "ownershipBillVerified" | "physicalPossessionVerified"
  ) => {
    const app = apps.find((a) => a.id === id);
    if (!app || !app.checklist) return;
    const currentVal = app.checklist[key];
    const updatedChecklist = {
      ...app.checklist,
      [key]: !currentVal,
    };
    updateApp(id, { checklist: updatedChecklist });
  };

  const handleResetToDefault = () => {
    if (window.confirm("Reset applications list back to initial seed data?")) {
      saveApplicationsToStorage(INITIAL_DIRECT_APPLICATIONS);
      setApps(INITIAL_DIRECT_APPLICATIONS);
    }
  };

  // Metrics
  const pendingVisitsCount = apps.filter((a) => a.kind === "owner" && a.status !== "approved" && a.status !== "rejected").length;
  const pendingProsCount = apps.filter((a) => a.kind === "professional" && a.status === "pending").length;
  const approvedCount = apps.filter((a) => a.status === "approved").length;

  const filteredApps = apps.filter((a) => {
    if (selectedKind !== "all" && a.kind !== selectedKind) return false;
    if (statusFilter === "pending") {
      if (a.status !== "pending" && a.status !== "visit_scheduled") return false;
    } else if (statusFilter !== "all" && a.status !== statusFilter) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = a.name.toLowerCase().includes(q);
      const matchPhone = a.phone.toLowerCase().includes(q);
      const matchSociety = a.society?.toLowerCase().includes(q) ?? false;
      const matchCompany = a.company?.toLowerCase().includes(q) ?? false;
      if (!matchName && !matchPhone && !matchSociety && !matchCompany) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Overview Stat Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-border/80 bg-card p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Total Applicants</span>
            <Users className="size-4.5 text-primary" />
          </div>
          <div className="mt-2 text-2xl font-black text-foreground">{apps.length}</div>
          <p className="text-xs text-muted-foreground mt-1">Direct portal applications</p>
        </div>

        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">Needs In-Person Visit</span>
            <Home className="size-4.5 text-amber-600" />
          </div>
          <div className="mt-2 text-2xl font-black text-amber-900 dark:text-amber-100">{pendingVisitsCount}</div>
          <p className="text-xs text-muted-foreground mt-1">Owners &amp; legal guardians to inspect</p>
        </div>

        <div className="rounded-2xl border border-blue-500/30 bg-blue-500/5 p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-700 dark:text-blue-400">Corporate Reviews</span>
            <Building2 className="size-4.5 text-blue-600" />
          </div>
          <div className="mt-2 text-2xl font-black text-blue-900 dark:text-blue-100">{pendingProsCount}</div>
          <p className="text-xs text-muted-foreground mt-1">LinkedIn &amp; work email checks</p>
        </div>

        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">Approved Members</span>
            <ShieldCheck className="size-4.5 text-emerald-600" />
          </div>
          <div className="mt-2 text-2xl font-black text-emerald-900 dark:text-emerald-100">{approvedCount}</div>
          <p className="text-xs text-muted-foreground mt-1">Direct access granted</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
        <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-xl bg-muted text-xs font-medium">
          <button
            onClick={() => setSelectedKind("all")}
            className={`px-3 py-1.5 rounded-lg transition ${
              selectedKind === "all" ? "bg-card text-foreground font-bold shadow-xs" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            All ({apps.length})
          </button>
          <button
            onClick={() => setSelectedKind("owner")}
            className={`px-3 py-1.5 rounded-lg transition ${
              selectedKind === "owner" ? "bg-card text-foreground font-bold shadow-xs text-amber-700 dark:text-amber-400" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Owners &amp; Guardians ({apps.filter((a) => a.kind === "owner").length})
          </button>
          <button
            onClick={() => setSelectedKind("professional")}
            className={`px-3 py-1.5 rounded-lg transition ${
              selectedKind === "professional" ? "bg-card text-foreground font-bold shadow-xs text-blue-700 dark:text-blue-400" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Corporate Pros ({apps.filter((a) => a.kind === "professional").length})
          </button>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative flex-1 sm:w-64">
            <Search className="size-3.5 text-muted-foreground absolute left-3 top-2.5" />
            <Input
              type="text"
              placeholder="Search name, phone, society..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 pl-8 text-xs"
            />
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={handleResetToDefault}
            className="h-8 text-xs text-muted-foreground hover:text-foreground gap-1"
          >
            <RotateCcw className="size-3" /> Reset Demo
          </Button>
        </div>
      </div>

      {/* Applications List */}
      <div className="space-y-4">
        {filteredApps.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/80 p-12 text-center text-sm text-muted-foreground">
            No applications match the selected filter.
          </div>
        ) : (
          filteredApps.map((app) => (
            <div
              key={app.id}
              className={`rounded-2xl border p-5 shadow-sm transition space-y-4 ${
                app.status === "approved"
                  ? "border-emerald-500/30 bg-emerald-500/5"
                  : app.status === "rejected"
                  ? "border-destructive/30 bg-destructive/5 opacity-75"
                  : "border-border/80 bg-card hover:border-border"
              }`}
            >
              {/* Header Row */}
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-base text-foreground">{app.name}</span>
                    <span className="text-xs text-muted-foreground font-mono">({app.phone})</span>

                    {/* Role Chip */}
                    {app.kind === "owner" ? (
                      <span className="rounded-full bg-amber-500/15 border border-amber-500/30 px-2.5 py-0.5 text-[10px] font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1">
                        <Home className="size-3" />
                        {app.ownershipType === "legal_guardian_family"
                          ? `Legal Guardian (${app.guardianRelationship})`
                          : "Primary Registered Owner"}
                      </span>
                    ) : (
                      <span className="rounded-full bg-blue-500/15 border border-blue-500/30 px-2.5 py-0.5 text-[10px] font-bold text-blue-800 dark:text-blue-300 flex items-center gap-1">
                        <Building2 className="size-3" /> Verified Professional
                      </span>
                    )}

                    {/* Status Chip */}
                    {app.status === "approved" ? (
                      <Badge variant="outline" className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 text-[10px]">
                        ✓ Approved &amp; Published
                      </Badge>
                    ) : app.status === "visit_scheduled" ? (
                      <Badge variant="outline" className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30 text-[10px]">
                        ● In-Person Visit Scheduled
                      </Badge>
                    ) : app.status === "rejected" ? (
                      <Badge variant="destructive" className="text-[10px]">
                        ✕ Rejected
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="text-[10px]">
                        ● Awaiting Review
                      </Badge>
                    )}
                  </div>

                  <p className="text-xs text-muted-foreground">
                    Applied on {new Date(app.createdAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
                    {app.reviewedAt && ` · Reviewed on ${new Date(app.reviewedAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}`}
                  </p>
                </div>

                {/* Direct Action Contacts */}
                <div className="flex items-center gap-2">
                  <Button asChild variant="outline" size="sm" className="h-8 text-xs gap-1">
                    <a href={`https://wa.me/${app.phone.replace(/[^0-9]/g, "")}`} target="_blank" rel="noopener noreferrer">
                      <MessageSquare className="size-3 text-emerald-600" /> WhatsApp
                    </a>
                  </Button>
                  <Button asChild variant="outline" size="sm" className="h-8 text-xs gap-1">
                    <a href={`tel:${app.phone}`}>
                      <Phone className="size-3 text-primary" /> Call
                    </a>
                  </Button>
                </div>
              </div>

              {/* Specific Details: Owner vs Professional */}
              {app.kind === "owner" ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1 text-xs">
                  <div className="rounded-xl border border-border/70 bg-muted/20 p-3.5 space-y-2">
                    <div className="font-bold text-foreground flex items-center gap-1.5 text-xs">
                      <Home className="size-3.5 text-emerald-600" /> Property &amp; Authority Breakdown
                    </div>
                    <div className="space-y-1 text-muted-foreground">
                      <div>
                        <strong>Society:</strong> <span className="text-foreground font-medium">{app.society} ({app.unitDetails})</span>
                      </div>
                      <div>
                        <strong>Config &amp; Rent:</strong> <span className="text-foreground font-semibold uppercase">{app.bhk}</span> · <span className="text-emerald-700 dark:text-emerald-400 font-bold">₹{app.expectedRent?.toLocaleString("en-IN")}/mo (₹0 Brokerage)</span>
                      </div>
                      <div>
                        <strong>Legal Guardian / Owner:</strong>{" "}
                        <span className="text-foreground font-medium">
                          {app.ownershipType === "legal_guardian_family"
                            ? `${app.name} (${app.guardianRelationship}) managing for ${app.registeredOwnerName}`
                            : `${app.name} (Sole Owner)`}
                        </span>
                      </div>
                      <div>
                        <strong>Tenant Criteria:</strong> <span className="text-foreground">{app.tenantCriteria}</span>
                      </div>
                    </div>
                  </div>

                  {/* Physical In-Person Legal Checklist */}
                  <div className="rounded-xl border border-border/70 bg-muted/20 p-3.5 space-y-2.5">
                    <div className="flex items-center justify-between font-bold text-foreground text-xs">
                      <span className="flex items-center gap-1.5">
                        <KeyRound className="size-3.5 text-primary" /> In-Person Physical &amp; Legal Checklist
                      </span>
                      <span className="text-[11px] text-amber-700 dark:text-amber-400 font-medium">
                        Slot: {app.preferredVisitSlot}
                      </span>
                    </div>

                    <div className="space-y-1.5 text-xs">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={app.checklist?.govtIdVerified ?? false}
                          onChange={() => handleToggleChecklist(app.id, "govtIdVerified")}
                          className="size-3.5 rounded text-emerald-600"
                        />
                        <span className={app.checklist?.govtIdVerified ? "text-emerald-700 dark:text-emerald-400 font-medium" : "text-muted-foreground"}>
                          1. Government ID of Owner/Guardian Checked (Aadhaar / Passport)
                        </span>
                      </label>

                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={app.checklist?.ownershipBillVerified ?? false}
                          onChange={() => handleToggleChecklist(app.id, "ownershipBillVerified")}
                          className="size-3.5 rounded text-emerald-600"
                        />
                        <span className={app.checklist?.ownershipBillVerified ? "text-emerald-700 dark:text-emerald-400 font-medium" : "text-muted-foreground"}>
                          2. Society Maintenance / Electricity Bill Name Match Verified
                        </span>
                      </label>

                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={app.checklist?.physicalPossessionVerified ?? false}
                          onChange={() => handleToggleChecklist(app.id, "physicalPossessionVerified")}
                          className="size-3.5 rounded text-emerald-600"
                        />
                        <span className={app.checklist?.physicalPossessionVerified ? "text-emerald-700 dark:text-emerald-400 font-medium" : "text-muted-foreground"}>
                          3. Physical Flat Keys &amp; Vacant Custody Confirmed
                        </span>
                      </label>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-border/70 bg-muted/20 p-3.5 text-xs space-y-1.5">
                  <div className="font-bold text-foreground flex items-center gap-1.5 text-xs mb-1">
                    <Building2 className="size-3.5 text-blue-600" /> Corporate Credentials
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-muted-foreground">
                    <div>
                      <strong>Employer &amp; Role:</strong>
                      <p className="text-foreground font-medium">{app.designation} at {app.company}</p>
                    </div>
                    <div>
                      <strong>Corporate Email:</strong>
                      <p className="text-foreground font-medium">{app.workEmail}</p>
                    </div>
                    <div>
                      <strong>LinkedIn Profile:</strong>
                      <p>
                        <a
                          href={app.linkedinUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline inline-flex items-center gap-1 font-medium"
                        >
                          View Profile <ExternalLink className="size-3" />
                        </a>
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-border/50">
                <div className="text-xs text-muted-foreground">
                  {app.rejectionReason && (
                    <span className="text-destructive font-medium">Rejection note: {app.rejectionReason}</span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {app.status !== "approved" && (
                    <Button
                      onClick={() => handleApprove(app)}
                      size="sm"
                      className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs gap-1.5 shadow-xs"
                    >
                      <CheckCircle2 className="size-3.5" />
                      {app.kind === "owner" ? "Approve (Legal & Physical Verified)" : "Approve Corporate Access"}
                    </Button>
                  )}

                  {app.status !== "rejected" && (
                    <Button
                      onClick={() => handleReject(app.id)}
                      variant="outline"
                      size="sm"
                      className="h-8 text-destructive border-destructive/30 hover:bg-destructive/10 text-xs gap-1"
                    >
                      <XCircle className="size-3.5" /> Reject
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
