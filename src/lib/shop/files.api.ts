/**
 * Files and uploads — `/api/files`.
 *
 * Shared by every authenticated role with per-role size limits. A file is
 * uploaded first and referenced afterwards by the returned `id` — never by a
 * hand-built path, because the storage layout is a backend detail and the
 * provider (`local` | `firebase` | `cloudinary`) decides the URL shape.
 *
 * ⚠ **This is general media intake.** You are not saying what a file is *for*,
 * so it lands in the folder for its own detected media type — `images/`,
 * `documents/`, and so on — which are all **public** trees. Purpose-scoped
 * private folders (`digital/`, `shipments/`) have their own dedicated endpoints
 * with their own role restrictions, and this route cannot write to them.
 *
 * See api-doc/uploads/README.md and api-doc/files/private-files.md.
 */
import { apiFetch } from "@/lib/api/client";

/** One uploaded file as the upload and list routes return it. */
export interface UploadedFile {
  id: string;
  originalName: string;
  mimeType: string;
  size: number;
  url: string | null;
  provider: string;
  ownerType: string;
  createdAt: string;
}

/**
 * A customer's per-file ceiling, in bytes.
 *
 * The roles differ (agency 200 MB, vendor 500 MB, agent 1 GB, admin 2 GB) and an
 * unrecognised role falls back to this one. Only the customer limit matters
 * here, and it is checked client-side purely so a shopper on a slow connection
 * is not made to upload 100 MB before being told no — the server enforces it
 * regardless, with `413 CATALOG_FILE_TOO_LARGE`.
 */
export const CUSTOMER_MAX_FILE_BYTES = 100 * 1024 * 1024;

/** `POST /files/upload` takes 1–10 files in one multipart request. */
export const MAX_FILES_PER_UPLOAD = 10;

/** `POST /files/upload/video`: 70 MB per file, and a customer may send **one**. */
export const MAX_VIDEO_BYTES = 70 * 1024 * 1024;
export const CUSTOMER_MAX_VIDEOS = 1;

/**
 * POST /api/files/upload — 1–10 files, multipart, form field `files`.
 *
 * The type is taken from the file's actual bytes rather than its extension or
 * declared `Content-Type`, and follows any conversion the pipeline applies, so
 * the caller does not get to choose where it lands.
 *
 * A policy failure is `400 UPLOAD_POLICY_VIOLATION` with
 * `error.details.violations[]` naming each one — `MIME_NOT_ALLOWED`,
 * `MIME_TYPE_MISMATCH`, `UNDETECTABLE_TYPE`, `QUOTA_EXCEEDED`,
 * `VIRUS_DETECTED` — which is worth surfacing per file rather than as one
 * "upload failed".
 */
export async function uploadFiles(files: File[]): Promise<UploadedFile[]> {
  const form = new FormData();
  for (const file of files.slice(0, MAX_FILES_PER_UPLOAD)) form.append("files", file);

  const data = await apiFetch<UploadedFile[]>("/api/files/upload", {
    method: "POST",
    body: form,
  });
  return Array.isArray(data) ? data : [];
}

/** POST /api/files/upload/video — form field `videos`. */
export async function uploadVideos(videos: File[]): Promise<UploadedFile[]> {
  const form = new FormData();
  for (const video of videos.slice(0, CUSTOMER_MAX_VIDEOS)) form.append("videos", video);

  const data = await apiFetch<UploadedFile[]>("/api/files/upload/video", {
    method: "POST",
    body: form,
  });
  return Array.isArray(data) ? data : [];
}





/**
 * Why a single file was refused.
 *
 * `UPLOAD_POLICY_VIOLATION` carries one entry per offending file, so a batch
 * that fails on one member can say which — collapsing them into a single
 * message loses the only information the caller can act on.
 */
export interface UploadViolation {
  code: string;
  message?: string;
  fileName?: string;
}

/** Pulls `details.violations[]` off a thrown upload error, if it carries any. */
export function uploadViolations(err: unknown): UploadViolation[] {
  const details = (err as { details?: { violations?: UploadViolation[] } })?.details;
  return Array.isArray(details?.violations) ? details.violations : [];
}

/**
 * Upload a mixed pick of images, documents and videos.
 *
 * Videos have their **own route** with its own limits — 70 MB and, for a
 * customer, exactly one — so a mixed selection is split rather than posted
 * wholesale to `/files/upload`. That route would accept a video (it classifies
 * by detected type and has a `videos/` tree), but it would apply the wrong
 * ceiling and the wrong count limit, so the failure would arrive as a confusing
 * `413` rather than as "one video at a time".
 *
 * Returns everything that uploaded, from both routes.
 */
export async function uploadAttachments(files: File[]): Promise<UploadedFile[]> {
  const videos = files.filter((f) => f.type.startsWith("video/"));
  const rest = files.filter((f) => !f.type.startsWith("video/"));

  const out: UploadedFile[] = [];
  if (rest.length > 0) out.push(...(await uploadFiles(rest)));
  if (videos.length > 0) out.push(...(await uploadVideos(videos)));
  return out;
}

/** The ceiling that applies to one picked file, by kind. */
export function maxBytesFor(file: File): number {
  return file.type.startsWith("video/") ? MAX_VIDEO_BYTES : CUSTOMER_MAX_FILE_BYTES;
}
