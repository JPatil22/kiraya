import { TrendingDown, TrendingUp, Minus } from "lucide-react";
import { formatINR } from "@/lib/utils";
import { PRICE_NOISE_PCT } from "@/lib/insights";
import type { PriceContext as PriceContextData } from "@/types/database";

/**
 * "Is this a fair rent?" — the judgement the cost breakdown was always meant to
 * enable, and the one number the product held all the inputs for and never said.
 *
 * Worded as a comparison, not a verdict. A flat can be worth more than the
 * median for reasons a database cannot see, so this reports where it sits and
 * lets the reader decide.
 */
export function PriceContext({
  context,
  bhkLabel,
  localityName,
}: {
  context: PriceContextData;
  bhkLabel: string;
  localityName: string;
}) {
  const pct = context.pct_vs_median ?? 0;
  const near = Math.abs(pct) <= PRICE_NOISE_PCT;
  const above = pct > 0;

  const Icon = near ? Minus : above ? TrendingUp : TrendingDown;

  return (
    <div className="flex items-start gap-3 rounded-lg border bg-muted/50 p-3 text-sm">
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <p>
        {near ? (
          <>
            <span className="font-medium">About the going rate.</span> Comparable{" "}
            {bhkLabel} listings in {localityName} sit around{" "}
            {formatINR(context.median_all_in ?? 0)} all-in.
          </>
        ) : (
          <>
            <span className="font-medium">
              About {Math.abs(pct)}% {above ? "above" : "below"} the going rate.
            </span>{" "}
            Comparable {bhkLabel} listings in {localityName} sit around{" "}
            {formatINR(context.median_all_in ?? 0)} all-in.
          </>
        )}{" "}
        <span className="text-muted-foreground">
          Median of {context.sample} other live {context.sample === 1 ? "listing" : "listings"}.
        </span>
      </p>
    </div>
  );
}
