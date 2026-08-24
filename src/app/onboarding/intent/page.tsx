import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { IntentForm } from "@/components/intents/intent-form";
import { submitIntent } from "../actions";

export default function IntentPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center px-6 py-10">
      <div className="mb-6">
        <p className="text-sm font-medium text-muted-foreground">Step 2 of 2</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">What are you looking for?</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          This structured intent is what owners and brokers act on — not a WhatsApp forward.
          Your contact details are never shared.
        </p>
      </div>

      <Card>
        <CardHeader className="sr-only">
          <CardTitle>Tenant intent</CardTitle>
          <CardDescription>Tell us your requirements.</CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <IntentForm action={submitIntent} submitLabel="Finish & see my dashboard" />
        </CardContent>
      </Card>
    </main>
  );
}
