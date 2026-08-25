import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { composeDigest, send, type PendingNotice, type Recipient } from "@/lib/email";

export const dynamic = "force-dynamic";

/**
 * The delivery run (0026).
 *
 * 0025 gave the product a clock; this is what carries what the clock writes
 * outside the building. It is a route rather than SQL because the API key
 * belongs in the app's environment rather than in the database, and because a
 * failed send is something you want to read in a log, not swallow in plpgsql.
 *
 * Safe to call as often as you like: it only ever picks up notifications with
 * `emailed_at is null` and stamps each one it delivers. Every fifteen minutes
 * is a good cadence — the digest then holds whatever accumulated in the window,
 * which is usually one thing, and nothing waits a day to be told.
 *
 * Point any scheduler at it:
 *
 *   curl -X POST -H "Authorization: Bearer $KIRAYA_CRON_SECRET" \
 *        https://your-host/api/notifications/deliver
 */

/** Nothing older than this: a backlog that failed for days is stale news. */
const LOOKBACK_HOURS = 72;

/** Bound the work per run so a bad night can't turn into a thousand sends. */
const MAX_RECIPIENTS = 50;

export async function POST(request: Request) {
  return deliver(request);
}

// Vercel Cron and most hosted schedulers issue GET. Same bearer either way.
export async function GET(request: Request) {
  return deliver(request);
}

async function deliver(request: Request) {
  const secret = process.env.KIRAYA_CRON_SECRET;

  // Fail closed. An unauthenticated endpoint that spends money on sends is
  // worse than one that is switched off.
  if (!secret) {
    return NextResponse.json(
      { error: "KIRAYA_CRON_SECRET is not set — delivery is disabled." },
      { status: 503 },
    );
  }

  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Not authorised." }, { status: 401 });
  }

  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json(
      { error: "RESEND_API_KEY is not set — nothing can be sent." },
      { status: 503 },
    );
  }

  const supabase = createServiceClient();
  const since = new Date(Date.now() - LOOKBACK_HOURS * 3_600_000).toISOString();

  const { data: pending, error: pendingError } = await supabase
    .from("notifications")
    .select("id, user_id, kind, body, property_id, created_at")
    .is("emailed_at", null)
    .gte("created_at", since)
    .order("created_at", { ascending: true })
    .limit(500);

  if (pendingError) {
    return NextResponse.json({ error: pendingError.message }, { status: 500 });
  }
  if (!pending || pending.length === 0) {
    return NextResponse.json({ sent: 0, recipients: 0, queued: 0 });
  }

  // Who has actually asked to be emailed. Everyone else stays queued and
  // in-app, which is the pre-0026 behaviour and a perfectly good one.
  const userIds = [...new Set(pending.map((n) => n.user_id))];
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, email, full_name")
    .in("id", userIds);

  const reachable = new Map(
    (profiles ?? [])
      .filter((p): p is typeof p & { email: string } => Boolean(p.email))
      .map((p) => [p.id, p]),
  );

  const byUser = new Map<string, Recipient>();
  for (const notice of pending) {
    const profile = reachable.get(notice.user_id);
    if (!profile) continue;

    const existing = byUser.get(notice.user_id);
    const item: PendingNotice = {
      id: notice.id,
      kind: notice.kind,
      body: notice.body,
      property_id: notice.property_id,
      created_at: notice.created_at,
    };

    if (existing) existing.notices.push(item);
    else
      byUser.set(notice.user_id, {
        userId: notice.user_id,
        email: profile.email,
        name: profile.full_name,
        notices: [item],
      });
  }

  const recipients = [...byUser.values()].slice(0, MAX_RECIPIENTS);
  const failures: { email: string; error: string }[] = [];
  let sent = 0;

  for (const recipient of recipients) {
    const { subject, html, text } = composeDigest(recipient);
    const result = await send(recipient.email, subject, html, text);

    if (!result.ok) {
      // Left unstamped on purpose: the next run tries again. A send that
      // failed is not a message anybody received.
      failures.push({ email: recipient.email, error: result.error });
      console.error(`[deliver] ${recipient.email}: ${result.error}`);
      continue;
    }

    const ids = recipient.notices.map((n) => n.id);
    const { error: stampError } = await supabase
      .from("notifications")
      .update({ emailed_at: new Date().toISOString() })
      .in("id", ids);

    if (stampError) {
      // Worse than a failed send: it went out and we cannot record that it
      // did, so the next run would repeat it. Loud, not silent.
      console.error(`[deliver] delivered to ${recipient.email} but could not stamp: ${stampError.message}`);
      failures.push({ email: recipient.email, error: `delivered but unstamped: ${stampError.message}` });
      continue;
    }

    sent += 1;
  }

  return NextResponse.json({
    sent,
    recipients: recipients.length,
    queued: pending.length,
    unreachable: userIds.length - reachable.size,
    failures,
  });
}
