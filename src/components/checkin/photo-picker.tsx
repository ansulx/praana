"use client";

import { useRef, useState } from "react";
import { Camera, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useT } from "@/components/providers/locale-provider";
import { api } from "@/lib/client/api";

export type PendingPhoto = { id: string; url: string };

const MAX_PHOTOS = 4;
const MAX_EDGE = 1600;

/** Downscale + re-encode to JPEG on the device: smaller uploads on mobile data, strips EXIF location. */
async function compress(file: File): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", 0.85));
    if (blob) return blob;
  } catch {
    /* browser can't decode (e.g. HEIC on some Androids) — try the original */
  }
  return file;
}

export function PhotoPicker({ photos, onChange, disabled }: { photos: PendingPhoto[]; onChange: (p: PendingPhoto[]) => void; disabled?: boolean }) {
  const t = useT();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(0);

  async function add(files: FileList | null) {
    if (!files?.length) return;
    const room = MAX_PHOTOS - photos.length - busy;
    const list = Array.from(files).slice(0, Math.max(0, room));
    if (files.length > list.length) toast.message(`You can add up to ${MAX_PHOTOS} photos per check-in.`);
    const added: PendingPhoto[] = [];
    setBusy((b) => b + list.length);
    await Promise.all(
      list.map(async (file) => {
        try {
          if (!file.type.startsWith("image/")) throw new Error("Please choose a photo.");
          const blob = await compress(file);
          const fd = new FormData();
          fd.append("photo", blob, "photo.jpg");
          const { id } = await api<{ id: string }>("/api/photos", { method: "POST", body: fd, timeoutMs: 60_000 });
          added.push({ id, url: URL.createObjectURL(blob) });
        } catch (err) {
          toast.error((err as Error).message);
        } finally {
          setBusy((b) => b - 1);
        }
      }),
    );
    if (added.length) onChange([...photos, ...added]);
    if (input.current) input.current.value = "";
  }

  async function remove(p: PendingPhoto) {
    onChange(photos.filter((x) => x.id !== p.id));
    URL.revokeObjectURL(p.url);
    api(`/api/photos/${p.id}`, { method: "DELETE" }).catch(() => undefined);
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      {photos.map((p) => (
        <div key={p.id} className="relative size-20 overflow-hidden rounded-xl border">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={p.url} alt="Photo to send" className="size-full object-cover" />
          <button type="button" onClick={() => remove(p)} className="absolute top-1 right-1 grid size-7 place-items-center rounded-full bg-black/60 text-white" aria-label="Remove photo">
            <X className="size-4" />
          </button>
        </div>
      ))}
      {Array.from({ length: busy }).map((_, i) => (
        <div key={i} className="grid size-20 place-items-center rounded-xl border border-dashed">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      ))}
      {photos.length + busy < MAX_PHOTOS && (
        <>
          <input ref={input} type="file" accept="image/*" capture="environment" multiple hidden onChange={(e) => add(e.target.files)} />
          <Button type="button" variant="outline" disabled={disabled} onClick={() => input.current?.click()}>
            <Camera /> {t("checkin.addPhoto")}
          </Button>
        </>
      )}
    </div>
  );
}
