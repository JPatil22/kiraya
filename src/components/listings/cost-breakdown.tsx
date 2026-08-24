import { formatINR } from "@/lib/utils";

type Costs = {
  rent: number;
  maintenance_monthly: number;
  deposit: number;
  brokerage: number;
  one_time_charges: number;
  all_in_monthly: number;
  move_in_cost: number;
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
        <Line label="Brokerage" amount={costs.brokerage} muted />
        <Line label="Other one-time charges" amount={costs.one_time_charges} muted />
        <Total
          label="Move-in cost"
          amount={costs.move_in_cost}
          hint="Deposit + brokerage + one-time"
        />
      </div>
    </div>
  );
}
