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
import type { FileAccess } from "./shop.types";

/**
 * One uploaded file as the upload routes return it.
 *
 * ⚠ **This is a file *record*, not a `FileDetail`** — a strict superset of one,
 * keeping `provider`, the owner fields and the timestamps a `FileDetail` does
 * not carry. Only the fields this app actually reads are declared.
 *
 * `url` and `access` are computed by the same resolver every other file on the
 * platform passes through, so they carry the same privacy and quota rules.
 * **Attaching by `id` is still the right thing to do with the file**; `url` is
 * for *showing* it before it is attached to anything. Never store a URL where an
 * id belongs, never derive an id from a URL, and never hand-build a URL from
 * `key` — that last one is what these two fields exist to stop.
 */
export interface UploadedFile {
  id: string;
  originalName: string;
  mimeType: string;
  size: number;
  url: string | null;
  /**
   * Present on every `/api/files/*` response since 2026-09-08.
   *
   * Optional only so an older backend degrades rather than crashing — read it
   * through `publicUrl`, which treats a missing value as "not public".
   */
  access?: FileAccess;
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
 * A policy failure is `UPLOAD_POLICY_VIOLATION` with
 * `error.details.violations[]` naming each offending file, which is worth
 * surfacing per file rather than as one "upload failed". See
 * {@link UploadViolation} for the twelve codes.
 *
 * ⚠ **Two mechanisms answer here and they produce different codes.** Multer
 * parses the multipart before the handler runs, so its own ceilings are hit
 * first and answer with no `details`: a field name other than `files` or more
 * than ten parts is `400 VALIDATION_ERROR`, and a part over multer's hard 2 GB
 * ceiling is `413 CATALOG_FILE_TOO_LARGE`. Everything else is
 * `UPLOAD_POLICY_VIOLATION` — `413` when the file is over the caller's own role
 * ceiling, `400` otherwise, **including "no files attached"**, whose
 * `violations[0].code` is `NO_FILES_UPLOADED`. Sending nothing and sending
 * files under the wrong field name are therefore two different answers.
 */
export async function uploadFiles(files: File[]): Promise<UploadedFile[]> {
  const batch = files.slice(0, MAX_FILES_PER_UPLOAD);
  const form = new FormData();
  for (const file of batch) form.append("files", file);

  try {
    const data = await apiFetch<UploadedFile[]>("/api/files/upload", {
      method: "POST",
      body: form,
    });
    return Array.isArray(data) ? data : [];
  } catch (err) {
    rethrowWithFileNames(err, batch);
  }
}

/** POST /api/files/upload/video — form field `videos`. */
export async function uploadVideos(videos: File[]): Promise<UploadedFile[]> {
  const batch = videos.slice(0, CUSTOMER_MAX_VIDEOS);
  const form = new FormData();
  for (const video of batch) form.append("videos", video);

  try {
    const data = await apiFetch<UploadedFile[]>("/api/files/upload/video", {
      method: "POST",
      body: form,
    });
    return Array.isArray(data) ? data : [];
  } catch (err) {
    rethrowWithFileNames(err, batch);
  }
}





/**
 * Why a single file was refused.
 *
 * `UPLOAD_POLICY_VIOLATION` carries one entry per offending file, so a batch
 * that fails on one member can say which — collapsing them into a single
 * message loses the only information the caller can act on.
 */
export interface UploadViolation {
  /**
   * **Drive the UI off this, never off `message`.** The twelve values are
   * `FILE_TOO_LARGE`, `MIME_NOT_ALLOWED`, `MIME_TYPE_MISMATCH`,
   * `UNDETECTABLE_TYPE`, `POLYGLOT_DETECTED`, `VIRUS_DETECTED`,
   * `QUOTA_EXCEEDED`, `TOTAL_SIZE_EXCEEDED`, `DUPLICATE_FILE`,
   * `PERMISSION_DENIED`, `TOO_MANY_FILES` and `NO_FILES_UPLOADED`.
   */
  code: string;
  message?: string;
  /**
   * Which file in the batch, by position.
   *
   * ⚠ **The API sends `fileIndex`, not a name.** This field was declared as
   * `fileName` and was therefore always `undefined`, so every violation
   * rendered as "That file" and the per-file attribution the endpoint goes to
   * the trouble of sending was silently thrown away.
   */
  fileIndex?: number;
  metadata?: Record<string, unknown>;
  /**
   * Filled in **client-side** by {@link uploadFiles} / {@link uploadVideos},
   * which are the only places that still know which `File` an index refers to.
   * Never sent by the API.
   */
  fileName?: string;
}

/** Pulls `details.violations[]` off a thrown upload error, if it carries any. */
export function uploadViolations(err: unknown): UploadViolation[] {
  const details = (err as { details?: { violations?: UploadViolation[] } })?.details;
  return Array.isArray(details?.violations) ? details.violations : [];
}

/**
 * Resolve each violation's `fileIndex` to the name of the file it refers to,
 * then rethrow.
 *
 * Done here rather than at the call sites because an index is only meaningful
 * against *the batch that was posted*, and `uploadAttachments` splits a mixed
 * pick across two routes — so by the time an error reaches a component, nothing
 * knows whether index 0 means the first document or the first video.
 *
 * The violations are mutated in place on the caught error rather than wrapped in
 * a new one, so `instanceof ApiError` and every other field survive for the
 * shared error ladder.
 */
function rethrowWithFileNames(err: unknown, batch: File[]): never {
  for (const violation of uploadViolations(err)) {
    if (typeof violation.fileIndex === "number") {
      violation.fileName = batch[violation.fileIndex]?.name;
    }
  }
  throw err;
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
