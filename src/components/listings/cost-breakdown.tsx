import { brokerageClaim } from "@/lib/brokerage";
import { formatINR } from "@/lib/utils";
import type { UserRole } from "@/types/database";

type Costs = {
  rent: number;
  maintenance_monthly: number;
  deposit: number;
  brokerage: number;
  brokerage_disclosed: boolean;
  one_time_charges: number;
  all_in_monthly: number;
  move_in_cost: number;
  posted_by_role: UserRole | null;
};

function Line({
  label,
  amount,
  muted,
}: {
  label: string;
  amount: number;
  muted?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5 text-sm">
      <span className={muted ? "text-muted-foreground" : ""}>{label}</span>
      <span className="font-medium tabular-nums">{formatINR(amount)}</span>
    </div>
  );
}

/**
 * Brokerage is the one cost component where zero and silence used to look
 * identical (0023). A stated zero is worth saying out loud; an unstated one is
 * worth warning about, because it is the number a tenant will be surprised by
 * on the day.
 */
function BrokerageLine({ costs }: { costs: Costs }) {
  const claim = brokerageClaim(costs);

  if (claim === "charged") {
    return <Line label="Brokerage" amount={costs.brokerage} muted />;
  }

  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5 text-sm">
      <span className="text-muted-foreground">Brokerage</span>
      {claim === "none" ? (
        <span className="font-medium text-success">
          None
          <span className="ml-1.5 font-normal text-muted-foreground">
            {costs.posted_by_role === "owner" ? "· owner listing" : "· stated by the broker"}
          </span>
        </span>
      ) : (
        <span className="font-medium text-warning">Not stated</span>
      )}
    </div>
  );
}

function Total({ label, amount, hint }: { label: string; amount: number; hint: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-t pt-2.5">
      <div>
        <div className="text-sm font-semibold">{label}</div>
        <div className="text-xs text-muted-foreground">{hint}</div>
      </div>
      <span className="text-lg font-bold tabular-nums">{formatINR(amount)}</span>
    </div>
  );
}

/**
 * The anti-"price mismatch" component. Every rupee is itemised and both totals
 * are stated up front, so what a tenant reads here is what they pay on site.
 */
export function CostBreakdown({ costs }: { costs: Costs }) {
  return (
    <div className="grid gap-6 sm:grid-cols-2">
      <div>
        <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Every month
        </h3>
        <Line label="Rent" amount={costs.rent} />
        <Line label="Maintenance" amount={costs.maintenance_monthly} muted />
        <Total
          label="All-in monthly"
          amount={costs.all_in_monthly}
          hint="Rent + maintenance"
        />
      </div>

      <div>
        <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          One time, at move-in
        </h3>
        <Line label="Security deposit" amount={costs.deposit} />
        <BrokerageLine costs={costs} />
        <Line label="Other one-time charges" amount={costs.one_time_charges} muted />
        <Total
          label="Move-in cost"
          amount={costs.move_in_cost}
          hint="Deposit + brokerage + one-time"
        />
        {brokerageClaim(costs) === "unstated" ? (
          <p className="mt-2 text-xs text-warning">
            No brokerage was stated on this listing, so this total may not be everything
            you pay.
          </p>
        ) : null}
      </div>
    </div>
  );
}
