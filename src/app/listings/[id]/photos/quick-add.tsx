"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ClipboardPaste, ImagePlus, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { downscaleImage, thumbnailImage } from "@/lib/downscale";
import { ACCEPTED_MIME } from "@/lib/photos";
import type { RoomType } from "@/types/database";
import { uploadPhotos } from "./actions";

/**
 * Bulk "paste & tag" uploader (front-end only; reuses the per-photo uploadPhotos
 * action). The room cards below are the canonical one-per-room view; this panel
 * just makes filling them fast — paste a screenshot or drop several files, tag
 * each with a room, upload the batch in one go. Two items tagged to the same
 * room is refused here rather than silently replacing, which the per-slot form
 * can't express.
 */

export type SlotOption = {
  roomType: RoomType;
  roomIndex: number;
  label: string;
  required: boolean;
  hasPhoto: boolean;
};

type Staged = {
  id: string;
  file: File;
  previewUrl: string;
  /** Empty until tagged. Encoded elsewhere as `${roomType}:${roomIndex}`. */
  slotKey: string;
};

const keyOf = (roomType: RoomType, roomIndex: number) => `${roomType}:${roomIndex}`;

let counter = 0;

export function QuickAddPhotos({
  propertyId,
  slots,
}: {
  propertyId: string;
  slots: SlotOption[];
}) {
  const router = useRouter();
  const [items, setItems] = useState<Staged[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const itemsRef = useRef<Staged[]>([]);
  itemsRef.current = items;

  // Revoke object URLs on unmount so previews don't leak.
  useEffect(() => {
    return () => {
      for (const it of itemsRef.current) URL.revokeObjectURL(it.previewUrl);
    };
  }, []);

  /** The first room with no photo and not already claimed by a staged item. */
  function nextFreeSlotKey(taken: Set<string>): string {
    const free = slots.find(
      (s) => s.required && !s.hasPhoto && !taken.has(keyOf(s.roomType, s.roomIndex)),
    );
    if (free) return keyOf(free.roomType, free.roomIndex);
    const anyFree = slots.find((s) => !s.hasPhoto && !taken.has(keyOf(s.roomType, s.roomIndex)));
    return anyFree ? keyOf(anyFree.roomType, anyFree.roomIndex) : "";
  }

  function addFiles(files: File[]) {
    const images = files.filter((f) => ACCEPTED_MIME.includes(f.type) && f.size > 0);
    if (images.length === 0) return;
    setError(null);
    setItems((prev) => {
      const taken = new Set(prev.map((p) => p.slotKey).filter(Boolean));
      const next = [...prev];
      for (const file of images) {
        const slotKey = nextFreeSlotKey(taken);
        if (slotKey) taken.add(slotKey);
        next.push({
          id: `q${counter++}`,
          file,
          previewUrl: URL.createObjectURL(file),
          slotKey,
        });
      }
      return next;
    });
  }

  // Paste anywhere on the page while this panel is mounted.
  useEffect(() => {
    function onPaste(e: ClipboardEvent) {
      const files: File[] = [];
      for (const item of Array.from(e.clipboardData?.items ?? [])) {
        if (item.type.startsWith("image/")) {
          const f = item.getAsFile();
          if (f) files.push(f);
        }
      }
      if (files.length) {
        e.preventDefault();
        addFiles(files);
      }
    }
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
    // addFiles closes over `slots`, which is stable for the page's lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function removeItem(id: string) {
    setItems((prev) => {
      const gone = prev.find((p) => p.id === id);
      if (gone) URL.revokeObjectURL(gone.previewUrl);
      return prev.filter((p) => p.id !== id);
    });
  }

  function setSlot(id: string, slotKey: string) {
    setItems((prev) => prev.map((p) => (p.id === id ? { ...p, slotKey } : p)));
  }

  const untagged = items.filter((i) => !i.slotKey).length;
  const dupSlot = (() => {
    const seen = new Set<string>();
    for (const i of items) {
      if (!i.slotKey) continue;
      if (seen.has(i.slotKey)) return true;
      seen.add(i.slotKey);
    }
    return false;
  })();

  const canUpload = items.length > 0 && untagged === 0 && !dupSlot && !busy;

  async function uploadAll() {
    if (!canUpload) return;
    setBusy(true);
    setError(null);
    setProgress({ done: 0, total: items.length });

    const failures: string[] = [];
    let done = 0;
    for (const item of items) {
      const [roomType, roomIndexRaw] = item.slotKey.split(":");
      try {
        const [small, thumb] = await Promise.all([
          downscaleImage(item.file),
          thumbnailImage(item.file),
        ]);
        const fd = new FormData();
        fd.set("propertyId", propertyId);
        fd.set("roomType", roomType);
        fd.set("roomIndex", roomIndexRaw);
        fd.set("photo", small, small.name);
        if (thumb) fd.set("thumbnail", thumb, thumb.name);
        // Stamp the upload date automatically — no "when was this taken?" prompt.
        fd.set("capturedAt", new Date().toISOString().slice(0, 10));
        const res = await uploadPhotos(null, fd);
        if (res?.error) failures.push(`${label(item.slotKey)}: ${res.error}`);
      } catch {
        failures.push(`${label(item.slotKey)}: could not upload`);
      }
      done += 1;
      setProgress({ done, total: items.length });
    }

    // Clear the ones that went up; keep any that failed so they can be retried.
    for (const it of items) {
      if (!failures.some((f) => f.startsWith(label(it.slotKey)))) URL.revokeObjectURL(it.previewUrl);
    }
    setItems((prev) =>
      prev.filter((it) => failures.some((f) => f.startsWith(label(it.slotKey)))),
    );
    setBusy(false);
    setProgress(null);
    if (failures.length) setError(failures.join(" · "));
    router.refresh();
  }

  function label(slotKey: string): string {
    const s = slots.find((x) => keyOf(x.roomType, x.roomIndex) === slotKey);
    return s?.label ?? "Room";
  }

  return (
    <section
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        addFiles(Array.from(e.dataTransfer.files));
      }}
      className={`rounded-xl border-2 border-dashed p-4 transition-colors ${
        dragOver ? "border-primary bg-primary/5" : "border-muted-foreground/25 bg-muted/20"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          <ClipboardPaste className="size-4 text-muted-foreground" />
          Quick add — paste, drop, or choose several at once
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
        >
          <ImagePlus /> Choose files
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_MIME.join(",")}
          multiple
          className="hidden"
          onChange={(e) => {
            addFiles(Array.from(e.target.files ?? []));
            e.target.value = "";
          }}
        />
      </div>

      <p className="mt-1 text-xs text-muted-foreground">
        Press <kbd className="rounded border bg-background px-1">Ctrl/⌘ V</kbd> to paste a
        screenshot. Then tag each with its room and upload the batch. New photos are auto-tagged
        to the next empty room — change any that are wrong.
      </p>

      {items.length > 0 ? (
        <>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {items.map((it) => (
              <li key={it.id} className="flex gap-3 rounded-lg border bg-background p-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={it.previewUrl}
                  alt=""
                  className="size-16 shrink-0 rounded-md bg-muted object-cover"
                />
                <div className="min-w-0 flex-1 space-y-1">
                  <select
                    value={it.slotKey}
                    onChange={(e) => setSlot(it.id, e.target.value)}
                    disabled={busy}
                    className="w-full rounded-md border bg-background px-2 py-1 text-xs"
                  >
                    <option value="">— pick room —</option>
                    {slots.map((s) => (
                      <option
                        key={keyOf(s.roomType, s.roomIndex)}
                        value={keyOf(s.roomType, s.roomIndex)}
                      >
                        {s.label}
                        {s.hasPhoto ? " (replaces current)" : ""}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => removeItem(it.id)}
                    disabled={busy}
                    className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive"
                  >
                    <X className="size-3" /> Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button type="button" size="sm" onClick={uploadAll} disabled={!canUpload}>
              {busy ? <Loader2 className="animate-spin" /> : <ImagePlus />}
              {busy && progress
                ? `Uploading ${progress.done}/${progress.total}…`
                : `Upload ${items.length} photo${items.length === 1 ? "" : "s"}`}
            </Button>
            {untagged > 0 ? (
              <span className="text-xs text-warning">{untagged} still need a room.</span>
            ) : null}
            {dupSlot ? (
              <span className="text-xs text-warning">
                Two photos are tagged to the same room — one would overwrite the other.
              </span>
            ) : null}
          </div>
        </>
      ) : null}

      {error ? (
        <p className="mt-3 rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </section>
  );
}
