import { cn } from "@/lib/utils";

/**
 * The bilingual wordmark, used in every header so the brand reads the same
 * everywhere. Devanagari mark + a hairline divider + the Latin wordmark, on a
 * shared baseline. The Latin half is quieter on purpose — the script is the
 * mark, "Kiraya" is the romanisation for a reader who doesn't read Devanagari.
 */
export function BrandMark({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-baseline gap-1.5 text-lg tracking-tight", className)}>
      <span className="font-semibold">किराया</span>
      <span aria-hidden className="text-base font-light text-muted-foreground/40">|</span>
      <span className="font-medium text-muted-foreground">Kiraya</span>
    </span>
  );
}
