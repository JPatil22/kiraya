import { cn } from "@/lib/utils";

/**
 * The bilingual wordmark, used in every header so the brand reads the same
 * everywhere. Devanagari mark + a hairline divider + the Latin wordmark, on a
 * shared baseline. The Latin half is quieter on purpose — the script is the
 * mark, "Kiraya" is the romanisation for a reader who doesn't read Devanagari.
 */
export function BrandMark({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 text-lg tracking-tight group", className)}>
      <span className="relative flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm shadow-primary/30 transition-transform duration-200 group-hover:scale-105">
        <span className="text-xs font-bold leading-none">कि</span>
        <span className="absolute -inset-0.5 rounded-lg bg-primary/20 blur-[2px] -z-10 group-hover:opacity-100 transition-opacity" />
      </span>
      <span className="inline-flex items-baseline gap-1.5">
        <span className="font-bold text-foreground tracking-tight text-base sm:text-lg">किराया</span>
        <span aria-hidden className="hidden sm:inline text-sm font-light text-muted-foreground/30">|</span>
        <span className="hidden sm:inline font-semibold text-muted-foreground tracking-tight text-sm sm:text-base">Kiraya</span>
      </span>
    </span>
  );
}

