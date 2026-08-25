import type { NotificationKind } from "@/types/database";

/**
 * Email delivery for notifications (0026).
 *
 * The notification system has been mute since 0012: six kinds, all written by
 * database triggers, none able to reach anyone who isn't already looking at the
 * page. This is the mouth. It is deliberately the *only* thing that knows about
 * an email provider — the jobs write rows, the delivery run reads them, and
 * swapping Resend for an SMS sender later means replacing `send()` and nothing
 * else.
 */

const RESEND_ENDPOINT = "https://api.resend.com/emails";

/**
 * Resend's shared sandbox sender works with no domain verification, but only
 * delivers to the address that owns the API key. Set KIRAYA_EMAIL_FROM to a
 * verified domain before this reaches a real tenant.
 */
const DEFAULT_FROM = "Kiraya <onboarding@resend.dev>";

export type PendingNotice = {
  id: string;
  kind: NotificationKind;
  body: string;
  property_id: string | null;
  created_at: string;
};

export type Recipient = {
  userId: string;
  email: string;
  name: string | null;
  notices: PendingNotice[];
};

export type SendResult =
  | { ok: true; id: string | null }
  | { ok: false; error: string };

export function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

/**
 * One email per person per run, never one per notice. Both jobs in 0025 fire
 * daily and the triggers fire whenever, so a run can find several things at
 * once — and three separate emails about the same morning is how people learn
 * to filter you.
 */
export function composeDigest(recipient: Recipient): { subject: string; html: string; text: string } {
  const { notices, name } = recipient;
  const many = notices.length > 1;

  const subject = many
    ? `${notices.length} updates on Kiraya`
    : trimSubject(notices[0].body);

  const greeting = name ? `Hello ${name},` : "Hello,";
  const lead = many
    ? `${notices.length} things happened on your Kiraya account.`
    : "Something happened on your Kiraya account.";

  const items = notices
    .map((n) => {
      const href = n.property_id ? `${siteUrl()}/listings/${n.property_id}` : `${siteUrl()}/notifications`;
      return `<li style="margin:0 0 12px"><a href="${href}" style="color:#0b1220">${escapeHtml(n.body)}</a></li>`;
    })
    .join("");

  const html = [
    `<div style="font-family:ui-sans-serif,system-ui,-apple-system,'Segoe UI',sans-serif;color:#0b1220;line-height:1.6;max-width:34rem">`,
    `<p style="margin:0 0 4px;font-size:18px;font-weight:600">किराया Kiraya</p>`,
    `<p style="margin:0 0 16px;color:#64748b;font-size:14px">${escapeHtml(lead)}</p>`,
    `<p style="margin:0 0 12px">${escapeHtml(greeting)}</p>`,
    `<ul style="padding-left:18px;margin:0 0 20px">${items}</ul>`,
    `<p style="margin:0 0 20px"><a href="${siteUrl()}/notifications" style="color:#0b1220">Open Kiraya</a></p>`,
    `<p style="margin:0;color:#64748b;font-size:12px">You get these because you added an email address to your Kiraya profile. Remove it there to stop them.</p>`,
    `</div>`,
  ].join("");

  const text = [
    greeting,
    "",
    lead,
    "",
    ...notices.map((n) => `- ${n.body}`),
    "",
    `${siteUrl()}/notifications`,
  ].join("\n");

  return { subject, html, text };
}

/** Subjects are a header, not a paragraph. */
function trimSubject(body: string): string {
  const flat = body.replace(/\s+/g, " ").trim();
  return flat.length <= 90 ? flat : `${flat.slice(0, 87)}…`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * The one call that talks to a provider. Returns rather than throws: one bad
 * address must not abandon everybody else queued behind it in the same run.
 */
export async function send(
  to: string,
  subject: string,
  html: string,
  text: string,
): Promise<SendResult> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { ok: false, error: "RESEND_API_KEY is not set" };

  try {
    const response = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.KIRAYA_EMAIL_FROM ?? DEFAULT_FROM,
        to: [to],
        subject,
        html,
        text,
      }),
    });

    const payload = (await response.json().catch(() => null)) as
      | { id?: string; message?: string; name?: string }
      | null;

    if (!response.ok) {
      return {
        ok: false,
        error: payload?.message ?? `Resend returned ${response.status}`,
      };
    }

    return { ok: true, id: payload?.id ?? null };
  } catch (cause) {
    return { ok: false, error: cause instanceof Error ? cause.message : "network error" };
  }
}
