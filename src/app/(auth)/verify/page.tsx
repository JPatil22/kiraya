import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { VerifyForm } from "./verify-form";

function maskPhone(e164: string): string {
  // +919876543210 → +91 ••••• 3210
  const last4 = e164.slice(-4);
  return `+91 ••••• ${last4}`;
}

export default async function VerifyPage() {
  const cookieStore = await cookies();
  const phone = cookieStore.get("otp_phone")?.value;
  if (!phone) redirect("/login");

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 py-10">
      <Link href="/" className="mb-8 text-center text-lg font-bold tracking-tight">
        किराया <span className="text-muted-foreground">Kiraya</span>
      </Link>
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Enter the code</CardTitle>
          <CardDescription>
            Sent to <span className="font-medium text-foreground">{maskPhone(phone)}</span>.{" "}
            <Link href="/login" className="underline underline-offset-4">
              Change number
            </Link>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <VerifyForm phone={phone} />
        </CardContent>
      </Card>
    </main>
  );
}
