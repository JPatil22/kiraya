import { Wallet } from "lucide-react";
import { formatINR } from "@/lib/utils";
import type { DepositContext as DepositContextData } from "@/types/database";

/**
 * "Is that deposit normal?" (0032)
 *
 * The largest number a tenant hands over, and the one they have no way to
 * check. Stated in months of rent because that is how deposits are quoted,
 * argued over and remembered — ₹1,50,000 is generous against a ₹50,000 flat and
 * punitive against a ₹15,000 one, so rupees alone say nothing.
 *
 * A comparison, not a verdict, exactly like the rent one. A landlord may have
 * good reasons for asking more; this reports where the number sits and leaves
 * the judgement where it belongs.
 */
export function DepositContext({
  context,
  bhkLabel,
  localityName,
}: {
  context: DepositContextData;
  bhkLabel: string;
  localityName: string;
}) {
  const months = context.months ?? 0;
  const median = context.median_months ?? 0;
  const difference = months - median;
  // Half a month either way is quoting noise, not a difference worth flagging.
  const near = Math.abs(difference) < 0.5;
  const higher = difference > 0;

  return (
    <div className="flex items-start gap-3 rounded-lg border bg-muted/50 p-3 text-sm">
      <Wallet
        className={
          near ? "mt-0.5 size-4 shrink-0 text-muted-foreground"
          : higher ? "mt-0.5 size-4 shrink-0 text-warning"
          : "mt-0.5 size-4 shrink-0 text-success"
        }
      />
      <div>
        <p>
          <span className="font-medium">{formatINR(context.deposit)}</span> deposit —{" "}
          <span className="font-medium">{trim(months)} months&apos; rent</span>
          {near ? (
            <>, about the usual for a {bhkLabel} in {localityName}.</>
          ) : higher ? (
            <>
              , where the usual {bhkLabel} in {localityName} asks{" "}
              <span className="font-medium">{trim(median)}</span>.
            </>
          ) : (
            <>
              , below the usual <span className="font-medium">{trim(median)}</span> for a{" "}
              {bhkLabel} in {localityName}.
            </>
          )}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Median of {context.sample} comparable listing{context.sample === 1 ? "" : "s"}, this one
          excluded.
        </p>
      </div>
    </div>
  );
}

/** 3.0 months reads worse than 3 months. */
function trim(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}
