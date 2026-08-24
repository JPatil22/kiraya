"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BHK_OPTIONS, FURNISHING_OPTIONS, OCCUPANCY_OPTIONS } from "@/lib/constants";
import type { Area } from "@/types/database";

/**
 * Shared by onboarding and the standalone /intent screen.
 *
 * An intent isn't a one-time onboarding answer — it's a standing description of
 * what someone wants, which brokers read and which changes as a search drags
 * on. Same form both times, so the two can't drift.
 */
export type IntentFormState = {
  error?: string;
  fieldErrors?: Record<string, string>;
} | null;

export type IntentFormInitial = {
  areaId: string;
  budgetMin: string;
  budgetMax: string;
  bhk: string;
  moveInDate: string;
  furnishing: string;
  occupancy: string;
  notes: string;
};

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-sm text-destructive">{message}</p>;
}

export function IntentForm({
  action: serverAction,
  initial,
  submitLabel,
  areas,
}: {
  action: (prev: IntentFormState, formData: FormData) => Promise<IntentFormState>;
  initial?: IntentFormInitial;
  submitLabel: string;
  areas: Area[];
}) {
  const [state, action, pending] = useActionState(serverAction, null);
  const err = (f: string) => state?.fieldErrors?.[f];
  // Matches intentSchema's "can't be in the past" rule. An older intent whose
  // date has already passed shows as out-of-range on purpose — that's the
  // signal it needs a new one, not something to paper over.
  const today = new Date().toISOString().slice(0, 10);

  return (
    <form action={action} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="areaId">Area</Label>
        <select
          id="areaId"
          name="areaId"
          defaultValue={initial?.areaId ?? ""}
          className="flex h-9 w-full items-center rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <option value="">Anywhere in the city</option>
          {areas.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
        <p className="text-xs text-muted-foreground">
          Narrowing this means new matches are actually near you.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="budgetMin">Min budget (₹/mo)</Label>
          <Input
            id="budgetMin"
            name="budgetMin"
            type="number"
            inputMode="numeric"
            min={1000}
            step={500}
            placeholder="15000"
            defaultValue={initial?.budgetMin}
          />
          <FieldError message={err("budgetMin")} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="budgetMax">Max budget (₹/mo)</Label>
          <Input
            id="budgetMax"
            name="budgetMax"
            type="number"
            inputMode="numeric"
            min={1000}
            step={500}
            placeholder="25000"
            defaultValue={initial?.budgetMax}
          />
          <FieldError message={err("budgetMax")} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="bhk">Configuration</Label>
          <Select name="bhk" defaultValue={initial?.bhk ?? "2bhk"}>
            <SelectTrigger id="bhk">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {BHK_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FieldError message={err("bhk")} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="moveInDate">Move-in by</Label>
          <Input id="moveInDate" name="moveInDate" type="date" min={today} defaultValue={initial?.moveInDate ?? today} />
          <FieldError message={err("moveInDate")} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="furnishing">Furnishing</Label>
          <Select name="furnishing" defaultValue={initial?.furnishing ?? "semi"}>
            <SelectTrigger id="furnishing">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FURNISHING_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FieldError message={err("furnishing")} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="occupancy">Occupancy</Label>
          <Select name="occupancy" defaultValue={initial?.occupancy ?? "any"}>
            <SelectTrigger id="occupancy">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {OCCUPANCY_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FieldError message={err("occupancy")} />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Anything else? (optional)</Label>
        <Textarea
          id="notes"
          name="notes"
          rows={3}
          maxLength={500}
          placeholder="e.g. need parking, pet-friendly, close to metro…"
          defaultValue={initial?.notes}
        />
        <FieldError message={err("notes")} />
      </div>

      {state?.error ? (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </div>
      ) : null}

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Saving…" : submitLabel}
      </Button>
    </form>
  );
}
