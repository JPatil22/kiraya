import React from "react";
import { Check, Sparkles } from "lucide-react";

/**
 * Transforms raw scraped Facebook post text into a clean, human-readable editorial description.
 * - Strips raw WhatsApp links and hidden number boilerplate (already handled by Contact card)
 * - Removes markdown bold asterisks (*GANGA SERIO* -> Ganga Serio)
 * - Normalizes aggressive ALL-CAPS text to clean sentence case
 * - Separates highlights/amenities into visual badge pills
 */
export function FormattedDescription({ text }: { text: string }) {
  if (!text) return null;

  // 1. Clean up noise & links
  let cleaned = text
    // Remove raw wa.link / wa.me links
    .replace(/https?:\/\/(wa\.link|wa\.me|api\.whatsapp\.com)\S+/gi, "")
    // Remove trailing "Call: [number hidden]", "Contact: [number hidden]"
    .replace(/(?:call|contact|whatsapp|dm|wsp)\s*:\s*\[number hidden\]/gi, "")
    .replace(/\[number hidden\]/gi, "")
    // Remove markdown asterisks (*text* -> text)
    .replace(/\*+(.*?)\*+/g, "$1")
    .trim();

  // Split into lines
  const rawLines = cleaned.split("\n").map((l) => l.trim()).filter(Boolean);

  const highlights: string[] = [];
  const bodyParagraphs: string[] = [];

  for (const line of rawLines) {
    // Skip empty or link-only lines
    if (!line || /^https?:\/\//i.test(line)) continue;

    // Check if line looks like a key highlight (e.g., "ALL ALLOWED", "RENT-42k", "Prime location...")
    const isHighlight =
      /^(highlights|amenities|features|society|all allowed|family & bachelor|ready|possession|parking|lift|power backup)/i.test(
        line,
      ) ||
      (line.length < 35 && !line.endsWith(".")) ||
      /^[-•✔✅★▪]\s*/.test(line);

    const cleanLine = line.replace(/^[-•✔✅★▪]\s*/, "").trim();
    if (!cleanLine) continue;

    // Normalize aggressive ALL CAPS lines (e.g. "2BHK SEMIFRUNISHED FLAT" -> "2BHK Semi-furnished flat")
    const formattedLine = formatCase(cleanLine);

    if (isHighlight && !formattedLine.toLowerCase().startsWith("highlights")) {
      // Skip redundant rent/phone lines in description
      if (/^rent\s*[-:]/i.test(formattedLine)) continue;
      highlights.push(formattedLine);
    } else if (!line.toLowerCase().startsWith("highlights")) {
      bodyParagraphs.push(formattedLine);
    }
  }

  return (
    <div className="space-y-4">
      {/* Key Highlights / Amenities Badges */}
      {highlights.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400 flex items-center gap-1.5">
            <Sparkles className="size-3.5 text-primary" /> Key Highlights &amp; Amenities
          </p>
          <div className="flex flex-wrap gap-2">
            {highlights.slice(0, 8).map((h, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1.5 rounded-lg border border-stone-200 dark:border-stone-800 bg-stone-50/80 dark:bg-stone-900/80 px-3 py-1.5 text-xs font-medium text-stone-800 dark:text-stone-200 shadow-2xs"
              >
                <Check className="size-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>{h}</span>
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {/* Main Narrative Description */}
      {bodyParagraphs.length > 0 ? (
        <div className="space-y-2.5 text-sm text-stone-700 dark:text-stone-300 leading-relaxed">
          {bodyParagraphs.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
      ) : (
        <p className="text-sm text-stone-600 dark:text-stone-400 leading-relaxed font-normal">
          {formatCase(cleaned)}
        </p>
      )}
    </div>
  );
}

/**
 * Normalizes aggressive ALL-CAPS sentences to clean title/sentence case.
 */
function formatCase(str: string): string {
  // If line is mostly UPPERCASE, convert to title case
  const uppercaseChars = str.replace(/[^A-Z]/g, "").length;
  const totalLetters = str.replace(/[^a-zA-Z]/g, "").length;

  if (totalLetters > 4 && uppercaseChars / totalLetters > 0.6) {
    return str
      .toLowerCase()
      .replace(/\b([a-z])/g, (c) => c.toUpperCase())
      .replace(/\b2bhk\b/gi, "2 BHK")
      .replace(/\b3bhk\b/gi, "3 BHK")
      .replace(/\b1bhk\b/gi, "1 BHK")
      .replace(/\b1rk\b/gi, "1 RK")
      .replace(/\bSemifrunished\b/gi, "Semi-furnished")
      .replace(/\bSemifurnished\b/gi, "Semi-furnished")
      .replace(/\bFullfurnished\b/gi, "Fully Furnished")
      .replace(/\bIt\b/g, "IT")
      .replace(/\bEon\b/g, "EON")
      .replace(/\bWtc\b/g, "WTC");
  }

  return str
    .replace(/\bSemifrunished\b/gi, "Semi-furnished")
    .replace(/\bSemifurnished\b/gi, "Semi-furnished");
}
