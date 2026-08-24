"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  AVAILABILITY_OPTIONS,
  BHK_OPTIONS,
  FURNISHING_OPTIONS,
  OCCUPANCY_OPTIONS,
} from "@/lib/constants";
import { formatINR } from "@/lib/utils";
import type { Area } from "@/types/database";

/**
 * Shared by "post a property" and "edit listing". The two differ only in which
 * server action they submit to and what they start with — the fields, the money
 * maths and the live preview are identical, and a tenant should never be able to
 * tell which screen a listing came through.
 */
export type ListingFormState = {
  error?: string;
  fieldErrors?: Record<string, string>;
} | null;

export type ListingFormInitial = {
  title: string;
  areaId: string;
  description: string;
  addressLine: string;
  bhk: string;
  furnishing: string;
  occupancy: string;
  rent: string;
  deposit: string;
  maintenanceMonthly: string;
  brokerage: string;
  oneTimeCharges: string;
  availableFrom: string;
  availability: string;
};

const selectClass =
  "flex h-9 w-full items-center rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-sm text-destructive">{message}</p>;
}

function toInt(v: string) {
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : 0;
}

export function ListingForm({
  action: serverAction,
  initial,
  submitLabel,
  pendingLabel,
  hint,
  hiddenFields,
  areas,
}: {
  action: (prev: ListingFormState, formData: FormData) => Promise<ListingFormState>;
  initial?: ListingFormInitial;
  submitLabel: string;
  pendingLabel: string;
  hint: string;
  hiddenFields?: Record<string, string>;
  areas: Area[];
}) {
  const [state, action, pending] = useActionState(serverAction, null);
  const err = (f: string) => state?.fieldErrors?.[f];

  // Live preview of the two numbers a tenant actually cares about.
  const [rent, setRent] = useState(initial?.rent ?? "");
  const [maintenance, setMaintenance] = useState(initial?.maintenanceMonthly ?? "");
  const [deposit, setDeposit] = useState(initial?.deposit ?? "");
  const [brokerage, setBrokerage] = useState(initial?.brokerage ?? "");
  const [oneTime, setOneTime] = useState(initial?.oneTimeCharges ?? "");

  const allInMonthly = toInt(rent) + toInt(maintenance);
  const moveInCost = toInt(deposit) + toInt(brokerage) + toInt(oneTime);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <form action={action} className="space-y-6">
      {Object.entries(hiddenFields ?? {}).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}

      <section className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="title">Title</Label>
          <Input
            id="title"
            name="title"
            maxLength={120}
            placeholder="Bright 2BHK near the park"
            defaultValue={initial?.title}
          />
          <FieldError message={err("title")} />
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="bhk">Configuration</Label>
            <select id="bhk" name="bhk" defaultValue={initial?.bhk ?? "2bhk"} className={selectClass}>
              {BHK_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <FieldError message={err("bhk")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="furnishing">Furnishing</Label>
            <select id="furnishing" name="furnishing" defaultValue={initial?.furnishing ?? "semi"} className={selectClass}>
              {FURNISHING_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <FieldError message={err("furnishing")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="occupancy">Preferred occupancy</Label>
            <select id="occupancy" name="occupancy" defaultValue={initial?.occupancy ?? "any"} className={selectClass}>
              {OCCUPANCY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <FieldError message={err("occupancy")} />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="areaId">Area</Label>
          <select
            id="areaId"
            name="areaId"
            defaultValue={initial?.areaId ?? ""}
            className={selectClass}
          >
            <option value="">Not sure / not listed</option>
            {areas.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground">
            Tenants filter by this, so a listing without one is much harder to find.
          </p>
          <FieldError message={err("areaId")} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="addressLine">Street / landmark (optional)</Label>
          <Input
            id="addressLine"
            name="addressLine"
            maxLength={200}
            placeholder="14th Main, near BDA complex"
            defaultValue={initial?.addressLine}
          />
          <FieldError message={err("addressLine")} />
        </div>
      </section>

      <section className="space-y-4 rounded-lg border p-4">
        <div>
          <h2 className="font-semibold">Cost breakdown</h2>
          <p className="text-sm text-muted-foreground">
            Enter every component. Tenants see all of it — that&apos;s the point.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="rent">Monthly rent (₹)</Label>
            <Input
              id="rent"
              name="rent"
              type="number"
              inputMode="numeric"
              min={0}
              step={500}
              placeholder="18000"
              value={rent}
              onChange={(e) => setRent(e.target.value)}
            />
            <FieldError message={err("rent")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="maintenanceMonthly">Monthly maintenance (₹)</Label>
            <Input
              id="maintenanceMonthly"
              name="maintenanceMonthly"
              type="number"
              inputMode="numeric"
              min={0}
              step={100}
              placeholder="2000"
              value={maintenance}
              onChange={(e) => setMaintenance(e.target.value)}
            />
            <FieldError message={err("maintenanceMonthly")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="deposit">Security deposit (₹)</Label>
            <Input
              id="deposit"
              name="deposit"
              type="number"
              inputMode="numeric"
              min={0}
              step={1000}
              placeholder="100000"
              value={deposit}
              onChange={(e) => setDeposit(e.target.value)}
            />
            <FieldError message={err("deposit")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="brokerage">Brokerage (₹)</Label>
            <Input
              id="brokerage"
              name="brokerage"
              type="number"
              inputMode="numeric"
              min={0}
              step={1000}
              placeholder="0"
              value={brokerage}
              onChange={(e) => setBrokerage(e.target.value)}
            />
            <FieldError message={err("brokerage")} />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="oneTimeCharges">Other one-time charges (₹)</Label>
            <Input
              id="oneTimeCharges"
              name="oneTimeCharges"
              type="number"
              inputMode="numeric"
              min={0}
              step={500}
              placeholder="0"
              value={oneTime}
              onChange={(e) => setOneTime(e.target.value)}
            />
            <FieldError message={err("oneTimeCharges")} />
          </div>
        </div>

        <div className="flex flex-wrap gap-6 rounded-md bg-muted px-4 py-3 text-sm">
          <div>
            <div className="text-xs text-muted-foreground">Tenant sees, monthly</div>
            <div className="font-semibold tabular-nums">{formatINR(allInMonthly)}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Tenant sees, to move in</div>
            <div className="font-semibold tabular-nums">{formatINR(moveInCost)}</div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="availableFrom">Available from</Label>
          <Input
            id="availableFrom"
            name="availableFrom"
            type="date"
            defaultValue={initial?.availableFrom ?? today}
          />
          <FieldError message={err("availableFrom")} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="availability">Current status</Label>
          <select
            id="availability"
            name="availability"
            defaultValue={initial?.availability ?? "available"}
            className={selectClass}
          >
            {AVAILABILITY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <FieldError message={err("availability")} />
        </div>
      </section>

      <div className="space-y-2">
        <Label htmlFor="description">Description (optional)</Label>
        <Textarea
          id="description"
          name="description"
          rows={4}
          maxLength={2000}
          placeholder="Two bedrooms, east-facing, covered parking, walking distance to the metro…"
          defaultValue={initial?.description}
        />
        <FieldError message={err("description")} />
      </div>

      {state?.error ? (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </div>
      ) : null}

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? pendingLabel : submitLabel}
        </Button>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
    </form>
  );
}
