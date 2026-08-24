import { ROLE_OPTIONS } from "@/lib/constants";
import { selectRole } from "../actions";
import { RoleCard } from "./role-card";

export default function RolePage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 py-10">
      <div className="mb-8">
        <p className="text-sm font-medium text-muted-foreground">Step 1 of 2</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">Who are you here as?</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          This shapes your whole experience. You can only be one at a time.
        </p>
      </div>

      <div className="grid gap-3">
        {ROLE_OPTIONS.map((opt) => (
          <form key={opt.value} action={selectRole}>
            <input type="hidden" name="role" value={opt.value} />
            <RoleCard label={opt.label} description={opt.description} />
          </form>
        ))}
      </div>
    </main>
  );
}
