import { CheckCircle2, PhoneOff, TriangleAlert } from "lucide-react";
import type { PublicAccuracy } from "@/types/database";

/**
 * What happened to people who actually went (0031).
 *
 * Every other trust signal on this page is the poster's own claim — the price
 * they typed, the date they confirmed, the rooms they photographed. This one is
 * the only thing on the listing said by somebody with nothing to gain, three
 * days after they stood outside the building.
 *
 * Deliberately unglamorous: a sentence and three counts. No stars, no score out
 * of five. A rating invites comparison between listings answered by four people
 * and listings answered by forty, which is exactly the false precision the rest
 * of this product refuses.
 */
export function VisitRecord({ accuracy }: { accuracy: PublicAccuracy }) {
  const { answered, matched, mismatched, unreachable, pct_matched } = accuracy;
  const mostlyGood = (pct_matched ?? 0) >= 70;

  return (
    <div className="rounded-xl border p-5">
      <h3 className="font-semibold">People who went</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Asked three days after they got the poster&apos;s number. Nobody is named, and the
        poster can&apos;t edit this.
      </p>

      <p className="mt-4 text-sm">
        <span className={mostlyGood ? "font-semibold text-success" : "font-semibold text-warning"}>
          {matched} of {answered}
        </span>{" "}
        said the flat matched the listing.
      </p>

      <ul className="mt-3 space-y-1.5 text-sm text-muted-foreground">
        <li className="flex items-center gap-2">
          <CheckCircle2 className="size-4 shrink-0 text-success" />
          {matched} found it as described
        </li>
        {mismatched > 0 ? (
          <li className="flex items-center gap-2">
            <TriangleAlert className="size-4 shrink-0 text-warning" />
            {mismatched} said something didn&apos;t match
          </li>
        ) : null}
        {unreachable > 0 ? (
          <li className="flex items-center gap-2">
            <PhoneOff className="size-4 shrink-0 text-warning" />
            {unreachable} couldn&apos;t reach the poster
          </li>
        ) : null}
      </ul>
    </div>
  );
}
