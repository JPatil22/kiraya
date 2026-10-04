import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

type NotificationType = "URL_UPDATED" | "URL_DELETED";

interface IndexingResponse {
  ok: boolean;
  type?: NotificationType;
  url?: string;
  error?: string;
}

/**
 * Mint a Google OAuth2 access token using a Service Account's RSA private key.
 * Uses native Node.js crypto to avoid adding bulky npm dependencies.
 */
async function getGoogleAccessToken(
  clientEmail: string,
  privateKey: string,
): Promise<string | null> {
  try {
    const now = Math.floor(Date.now() / 1000);
    const header = {
      alg: "RS256",
      typ: "JWT",
    };

    const claimSet = {
      iss: clientEmail,
      scope: "https://www.googleapis.com/auth/indexing",
      aud: "https://oauth2.googleapis.com/token",
      exp: now + 3600,
      iat: now,
    };

    const base64UrlEncode = (str: string) =>
      Buffer.from(str)
        .toString("base64")
        .replace(/=/g, "")
        .replace(/\+/g, "-")
        .replace(/\//g, "_");

    const encodedHeader = base64UrlEncode(JSON.stringify(header));
    const encodedClaimSet = base64UrlEncode(JSON.stringify(claimSet));
    const signatureInput = `${encodedHeader}.${encodedClaimSet}`;

    // Normalize escaped newlines in PEM string (standard for environment variables)
    const formattedKey = privateKey.replace(/\\n/g, "\n");

    const signer = crypto.createSign("RSA-SHA256");
    signer.update(signatureInput);
    signer.end();
    const signature = signer.sign(formattedKey);
    const encodedSignature = signature
      .toString("base64")
      .replace(/=/g, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");

    const jwt = `${signatureInput}.${encodedSignature}`;

    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion: jwt,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.warn("[Google Indexing] Failed to acquire access token:", errText);
      return null;
    }

    const data = (await res.json()) as { access_token?: string };
    return data.access_token ?? null;
  } catch (err) {
    console.warn("[Google Indexing] Token generation error:", err);
    return null;
  }
}

function resolveGoogleCredentials(): { clientEmail: string; privateKey: string } | null {
  // 1. Explicit env vars
  if (process.env.GOOGLE_INDEXING_CLIENT_EMAIL && process.env.GOOGLE_INDEXING_PRIVATE_KEY) {
    return {
      clientEmail: process.env.GOOGLE_INDEXING_CLIENT_EMAIL,
      privateKey: process.env.GOOGLE_INDEXING_PRIVATE_KEY,
    };
  }

  // 2. Path in env var
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS && fs.existsSync(process.env.GOOGLE_APPLICATION_CREDENTIALS)) {
    try {
      const content = JSON.parse(fs.readFileSync(process.env.GOOGLE_APPLICATION_CREDENTIALS, "utf-8"));
      if (content.client_email && content.private_key) {
        return { clientEmail: content.client_email, privateKey: content.private_key };
      }
    } catch {
      // ignore
    }
  }

  // 3. Look for downloaded key file in project root
  try {
    const cwd = process.cwd();
    const files = fs.readdirSync(cwd);
    const keyFile = files.find(
      (f) => f.endsWith(".json") && (f.startsWith("project-") || f.includes("service-account")),
    );
    if (keyFile) {
      const fullPath = path.join(cwd, keyFile);
      const content = JSON.parse(fs.readFileSync(fullPath, "utf-8"));
      if (content.client_email && content.private_key) {
        return { clientEmail: content.client_email, privateKey: content.private_key };
      }
    }
  } catch {
    // ignore
  }

  return null;
}

/**
 * Dispatch real-time index notification to Google Indexing API.
 * - URL_UPDATED: When listing is verified / goes live.
 * - URL_DELETED: When listing is marked rented / withdrawn.
 */
export async function notifyGoogleIndexing(
  urlOrPropertyId: string,
  type: NotificationType,
): Promise<IndexingResponse> {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.kirayah.xyz";
  const targetUrl = urlOrPropertyId.startsWith("http")
    ? urlOrPropertyId
    : `${siteUrl}/listings/${urlOrPropertyId}`;

  const credentials = resolveGoogleCredentials();

  if (!credentials) {
    // Graceful skip in dev/sandbox without credentials
    return {
      ok: false,
      url: targetUrl,
      type,
      error: "Google Indexing API credentials not found in environment or local key file.",
    };
  }

  const { clientEmail, privateKey } = credentials;

  try {
    const accessToken = await getGoogleAccessToken(clientEmail, privateKey);
    if (!accessToken) {
      return { ok: false, url: targetUrl, type, error: "Could not obtain Google access token." };
    }

    const res = await fetch(
      "https://indexing.googleapis.com/v3/urlNotifications:publish",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          url: targetUrl,
          type,
        }),
      },
    );

    if (!res.ok) {
      const errText = await res.text();
      console.warn(`[Google Indexing] Error publishing ${type} for ${targetUrl}:`, errText);
      return { ok: false, url: targetUrl, type, error: errText };
    }

    return { ok: true, url: targetUrl, type };
  } catch (err) {
    console.error(`[Google Indexing] Unexpected network error for ${targetUrl}:`, err);
    return { ok: false, url: targetUrl, type, error: String(err) };
  }
}
