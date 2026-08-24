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
}: {
  role: UserRole | null;
  name?: string | null;
  showName?: boolean;
}) {
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
