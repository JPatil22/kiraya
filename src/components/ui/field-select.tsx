"use client";

import { useEffect, useState } from "react";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/**
 * The dropdown every form uses.
 *
 * These were native `<select>` elements until now, which is why the forms read
 * as much older than they are — a raw OS dropdown drags the whole page back a
 * decade however carefully everything around it is set. Radix renders a real
 * listbox and, given a `name`, a hidden native input alongside it, so server
 * actions keep reading plain FormData and nothing upstream changes.
 *
 * Groups are optional and only earn their keep past a certain length: the area
 * list is fifty entries and unusable ungrouped, while furnishing is three.
 */

export type SelectChoice = { value: string; label: string };
export type SelectChoiceGroup = { group: string; choices: SelectChoice[] };

export function FieldSelect({
  name,
  value,
  defaultValue,
  onValueChange,
  placeholder,
  id,
  choices,
  groups,
  className,
}: {
  name: string;
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  id?: string;
  /** Flat list — for short sets where grouping would be noise. */
  choices?: SelectChoice[];
  /** Grouped list, used by the fifty Pune areas. */
  groups?: SelectChoiceGroup[];
  className?: string;
}) {
  // Radix's <SelectValue> renders empty during SSR and only fills the selected
  // label in on the client, which hydration flags as a mismatch. Render the
  // label ourselves from the choices so server and client agree, tracking the
  // selection in state so uncontrolled selects still update when changed.
  const all = [...(choices ?? []), ...(groups?.flatMap((g) => g.choices) ?? [])];
  const [selected, setSelected] = useState(value ?? defaultValue);
  const current = value ?? selected;
  const selectedLabel = all.find((c) => c.value === current)?.label;

  // Radix's hidden native <select> collects its <option>s from the items below
  // on the client only — it is empty on the server — so rendering the items from
  // the first paint is what still mismatches. Hold them back until after mount:
  // server and first client render then agree, and the dropdown fills in a tick
  // later. The visible label and the submitted value are both ours (above), so
  // nothing the user sees or submits is missing in the meantime.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <>
      {/*
        Carry the value in our own hidden input rather than letting Radix render
        its built-in hidden <select name>: that native select's <option>s are
        collected on the client only, so it is empty on the server and hydration
        flags the mismatch. `current` tracks the live selection, so uncontrolled
        selects still submit what the user picked. `readOnly` keeps it in
        FormData (a disabled input would be dropped).
      */}
      <input type="hidden" name={name} value={current ?? ""} readOnly />
      <Select
        value={value}
        defaultValue={defaultValue}
        onValueChange={(next) => {
          setSelected(next);
          onValueChange?.(next);
        }}
      >
        <SelectTrigger id={id} className={className}>
          <SelectValue placeholder={placeholder}>{selectedLabel}</SelectValue>
        </SelectTrigger>
        {mounted ? (
          <SelectContent className="max-h-80">
            {choices?.map((choice) => (
              <SelectItem key={choice.value} value={choice.value}>
                {choice.label}
              </SelectItem>
            ))}
            {groups?.map(({ group, choices: inGroup }) => (
              <SelectGroup key={group}>
                <SelectLabel className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {group}
                </SelectLabel>
                {inGroup.map((choice) => (
                  <SelectItem key={choice.value} value={choice.value}>
                    {choice.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            ))}
          </SelectContent>
        ) : null}
      </Select>
    </>
  );
}
