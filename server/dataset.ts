import { appendFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

/** Class labels, used verbatim as folder names under the dataset root. */
export const LABELS = ["handgrip", "no_handgrip"] as const;
export type Label = (typeof LABELS)[number];

const DATASET_DIR = "dataset";
const MANIFEST_PATH = join(DATASET_DIR, "manifest.csv");
const MANIFEST_HEADER =
  "full_path,crop_path,label,session,has_hand,captured_at\n";

/** Sessions become part of file names, so keep them to a safe charset. */
const SESSION_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

function isLabel(value: unknown): value is Label {
  return LABELS.includes(value as Label);
}

function badRequest(message: string): Response {
  return Response.json({ error: message }, { status: 400 });
}

/**
 * Stores one labeled sample on disk:
 *
 *   dataset/full/<label>/<session>_<id>.jpg   — the whole frame
 *   dataset/crop/<label>/<session>_<id>.jpg   — the hand region, when detected
 *   dataset/manifest.csv                      — one row per sample
 *
 * The session is kept on every row so train/test can later be split by
 * recording session (consecutive frames are near-duplicates).
 */
export async function saveSample(request: Request): Promise<Response> {
  const form = await request.formData();
  const label = form.get("label");
  const session = form.get("session");
  const full = form.get("full");
  const crop = form.get("crop");

  if (!isLabel(label)) return badRequest(`label must be one of ${LABELS.join(", ")}`);
  if (typeof session !== "string" || !SESSION_PATTERN.test(session)) {
    return badRequest("invalid session");
  }
  if (!(full instanceof Blob)) return badRequest("missing full image");

  const name = `${session}_${Date.now()}_${crypto.randomUUID().slice(0, 8)}.jpg`;
  const fullPath = join(DATASET_DIR, "full", label, name);
  await Bun.write(fullPath, full);

  let cropPath = "";
  if (crop instanceof Blob) {
    cropPath = join(DATASET_DIR, "crop", label, name);
    await Bun.write(cropPath, crop);
  }

  await appendManifestRow([
    fullPath,
    cropPath,
    label,
    session,
    cropPath ? "1" : "0",
    new Date().toISOString(),
  ]);

  return Response.json({ fullPath, cropPath }, { status: 201 });
}

async function appendManifestRow(values: string[]): Promise<void> {
  await mkdir(DATASET_DIR, { recursive: true });
  const isNew = !(await Bun.file(MANIFEST_PATH).exists());
  const row = values.join(",") + "\n";
  await appendFile(MANIFEST_PATH, isNew ? MANIFEST_HEADER + row : row);
}

/** Counts stored full-frame samples per label. */
export async function datasetStats(): Promise<Response> {
  const counts = {} as Record<Label, number>;
  for (const label of LABELS) {
    const glob = new Bun.Glob("*.jpg");
    let count = 0;
    try {
      for await (const _ of glob.scan(join(DATASET_DIR, "full", label))) count++;
    } catch {
      // Folder does not exist yet — no samples for this label.
    }
    counts[label] = count;
  }
  return Response.json(counts);
}
