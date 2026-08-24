import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 py-10">
      <Link href="/" className="mb-8 text-center text-lg font-bold tracking-tight">
        किराया <span className="text-muted-foreground">Kiraya</span>
      </Link>
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Sign in or create an account</CardTitle>
          <CardDescription>
            We&apos;ll text you a one-time code. No passwords, no Aadhaar.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LoginForm />
        </CardContent>
      </Card>
    </main>
  );
}
