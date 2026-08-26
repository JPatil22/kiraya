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
import { LocationPicker } from "@/components/map/location-picker";
import { toCoords } from "@/lib/geo";
import { groupByZone } from "@/lib/areas";
import { FieldSelect } from "@/components/ui/field-select";
import type { Area, UserRole } from "@/types/database";

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
  brokerageDisclosed: boolean;
  latitude: number | null;
  longitude: number | null;
  oneTimeCharges: string;
  availableFrom: string;
  availability: string;
};


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
  posterRole,
}: {
  action: (prev: ListingFormState, formData: FormData) => Promise<ListingFormState>;
  initial?: ListingFormInitial;
  submitLabel: string;
  pendingLabel: string;
  hint: string;
  hiddenFields?: Record<string, string>;
  areas: Area[];
  /** Whose listing this is, which decides what may be claimed about the fee (0023). */
  posterRole: UserRole | null;
}) {
  const [state, action, pending] = useActionState(serverAction, null);
  const err = (f: string) => state?.fieldErrors?.[f];

  // Live preview of the two numbers a tenant actually cares about.
  const [rent, setRent] = useState(initial?.rent ?? "");
  const [maintenance, setMaintenance] = useState(initial?.maintenanceMonthly ?? "");
  const [deposit, setDeposit] = useState(initial?.deposit ?? "");
  const [brokerage, setBrokerage] = useState(initial?.brokerage ?? "");
  const [oneTime, setOneTime] = useState(initial?.oneTimeCharges ?? "");
  // Ticked only when the listing already says "zero, on purpose" — an existing
  // undisclosed 0 must stay unticked, because that is the thing being fixed.
  const [noBrokerage, setNoBrokerage] = useState(
    Boolean(initial?.brokerageDisclosed) && toInt(initial?.brokerage ?? "") === 0,
  );

  // 0028 — the area sits one field above the map and is the strongest hint
  // anyone gives us about where the flat is. Tracked so the map can open there
  // and place search can be biased to it, instead of to the whole city.
  const [areaId, setAreaId] = useState(initial?.areaId ?? "");
  const selectedArea = areas.find((a) => a.id === areaId);
  const areaCentre = toCoords(selectedArea?.latitude ?? null, selectedArea?.longitude ?? null);

  const allInMonthly = toInt(rent) + toInt(maintenance);
  const moveInCost = toInt(deposit) + toInt(brokerage) + toInt(oneTime);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <form action={action} className="space-y-6">
      {Object.entries(hiddenFields ?? {}).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}

      <section className="space-y-4 rounded-xl border p-5">
        <div>
          <h2 className="font-semibold">The flat</h2>
          <p className="text-sm text-muted-foreground">
            What it is and where. The area and the pin are what let a tenant decide
            without travelling.
          </p>
        </div>

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
            <FieldSelect
              id="bhk"
              name="bhk"
              defaultValue={initial?.bhk ?? "2bhk"}
              choices={BHK_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
            />
            <FieldError message={err("bhk")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="furnishing">Furnishing</Label>
            <FieldSelect
              id="furnishing"
              name="furnishing"
              defaultValue={initial?.furnishing ?? "semi"}
              choices={FURNISHING_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
            />
            <FieldError message={err("furnishing")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="occupancy">Preferred occupancy</Label>
            <FieldSelect
              id="occupancy"
              name="occupancy"
              defaultValue={initial?.occupancy ?? "any"}
              choices={OCCUPANCY_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
            />
            <FieldError message={err("occupancy")} />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="areaId">Area</Label>
          <FieldSelect
            id="areaId"
            name="areaId"
            value={areaId}
            onValueChange={setAreaId}
            placeholder="Not sure / not listed"
            groups={groupByZone(areas).map(({ zone, areas: inZone }) => ({
              group: zone,
              choices: inZone.map((a) => ({ value: a.id, label: a.name })),
            }))}
          />
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

        <div className="space-y-2">
          <Label>Pin it on the map</Label>
          <p className="text-xs text-muted-foreground">
            This is what saves a tenant an hour each way. Search for the society, then drag
            the pin onto the actual building — or stand at the gate and press
            &ldquo;I&apos;m here now&rdquo;.
          </p>
          <LocationPicker
            initialLat={initial?.latitude}
            initialLng={initial?.longitude}
            focus={areaCentre}
          />
          <FieldError message={err("latitude")} />
        </div>
      </section>

      <section className="space-y-4 rounded-xl border p-5">
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
          {posterRole === "owner" ? (
            // 0023: an owner listing carries no brokerage by definition, so
            // there is nothing to type. Stating it beats an empty box the
            // tenant can't distinguish from an unanswered one.
            <div className="space-y-2">
              <Label>Brokerage</Label>
              <div className="flex h-9 items-center rounded-md border border-dashed px-3 text-sm text-muted-foreground">
                None — you&apos;re posting as the owner.
              </div>
              <input type="hidden" name="brokerage" value="0" />
            </div>
          ) : (
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
                // readOnly rather than disabled: a disabled input is left out
                // of FormData entirely, and the server would see no answer at
                // all for the field the tick box exists to answer.
                value={noBrokerage ? "0" : brokerage}
                readOnly={noBrokerage}
                onChange={(e) => setBrokerage(e.target.value)}
              />
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <input
                  type="checkbox"
                  name="brokerageNone"
                  className="size-4 rounded border-input"
                  checked={noBrokerage}
                  onChange={(e) => {
                    setNoBrokerage(e.target.checked);
                    if (e.target.checked) setBrokerage("0");
                  }}
                />
                No brokerage on this listing
              </label>
              <FieldError message={err("brokerage")} />
            </div>
          )}
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

      <section className="space-y-4 rounded-xl border p-5">
        <div>
          <h2 className="font-semibold">Availability</h2>
          <p className="text-sm text-muted-foreground">
            Both of these are shown to tenants, and the date is what the freshness
            reminder measures against.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
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
          <FieldSelect
              id="availability"
              name="availability"
              defaultValue={initial?.availability ?? "available"}
              choices={AVAILABILITY_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
            />
          <FieldError message={err("availability")} />
        </div>
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
