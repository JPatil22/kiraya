"use client";

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
  return (
    <Select
      name={name}
      value={value}
      defaultValue={defaultValue}
      onValueChange={onValueChange}
    >
      <SelectTrigger id={id} className={className}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
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
    </Select>
  );
}
