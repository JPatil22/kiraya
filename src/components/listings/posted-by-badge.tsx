import { Building2, Megaphone, ShieldCheck, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { POSTED_BY_LABEL } from "@/lib/constants";
import type { UserRole } from "@/types/database";

const ICON: Record<UserRole, typeof Building2> = {
  owner: Building2,
  broker: Megaphone,
  admin: ShieldCheck,
  tenant: User,
};

/** Authorship, always visible — no anonymous listings. */
export function PostedByBadge({
  role,
  name,
  showName = false,
  sourcedBrokerName = null,
}: {
  role: UserRole | null;
  name?: string | null;
  showName?: boolean;
  /**
   * 0035 — when set, this listing was seeded by Kiraya from an outside post:
   * credit the real broker by name and mark it as aggregated, rather than
   * showing the seeding account as if it were the lister. The broker's number
   * is still only revealed on contact unlock.
   */
  sourcedBrokerName?: string | null;
}) {
  if (sourcedBrokerName) {
    // Some posts give only a number — "Broker" is the placeholder name then, and
    // the credit reads "Broker · via Kiraya" rather than "Broker: Broker".
    const named = sourcedBrokerName.trim().toLowerCase() !== "broker";
    return (
      <Badge variant="outline" className="gap-1 font-normal">
        <Megaphone className="size-3.5" />
        {named ? (
          <>
            Broker: <span className="font-medium">{sourcedBrokerName}</span>
          </>
        ) : (
          "Broker"
        )}
        <span className="text-muted-foreground">· via Kiraya</span>
      </Badge>
    );
  }

  if (!role) return null;
  const Icon = ICON[role];

  return (
    <Badge variant="outline" className="gap-1 font-normal">
      <Icon className="size-3.5" />
      {POSTED_BY_LABEL[role]}
      {showName && name ? <span className="font-medium">· {name}</span> : null}
    </Badge>
  );
}
