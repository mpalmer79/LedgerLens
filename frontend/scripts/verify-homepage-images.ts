#!/usr/bin/env tsx
/**
 * Verify the homepage stock-photography system is consistent.
 *
 * Rules:
 *
 *  1. For every **enabled** entry in `homepageImages.ts`:
 *     - the file at `src` exists under `frontend/public/`.
 *     - `alt` is non-empty and ≥ 20 characters.
 *     - a credit with the same `file` path lives in `imageCredits.ts`.
 *
 *  2. For every credit in `imageCredits.ts`:
 *     - the file at `file` exists on disk.
 *     - `photographer` is non-empty.
 *     - `sourceUrl` starts with `https://`.
 *     - `license` is one of "Unsplash" | "Pexels" | "Pixabay" | "Other".
 *
 * When `homepageImages` has zero enabled entries AND `imageCredits` is
 * empty, the script passes (the default prep state).
 *
 * Exits 0 on success with a one-line summary; exits 1 with a blunt
 * failure list otherwise.
 */
import { existsSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { HOMEPAGE_IMAGES } from "../src/data/homepageImages.js";
import { imageCredits } from "../src/data/imageCredits.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const FRONTEND = resolve(HERE, "..");
const PUBLIC = join(FRONTEND, "public");

const ALLOWED_LICENSES = new Set(["Unsplash", "Pexels", "Pixabay", "Other"]);
const MIN_ALT_LEN = 20;

type Failure = { scope: string; message: string };

function fileOnDisk(srcPath: string): boolean {
  if (!srcPath.startsWith("/")) return false;
  const full = join(PUBLIC, srcPath.replace(/^\//, ""));
  if (!existsSync(full)) return false;
  try {
    return statSync(full).isFile();
  } catch {
    return false;
  }
}

function main(): void {
  const failures: Failure[] = [];

  // ── enabled-image rules ──────────────────────────────────────────
  const enabled = HOMEPAGE_IMAGES.filter((i) => i.enabled);
  const creditsByFile = new Map(imageCredits.map((c) => [c.file, c]));

  for (const img of enabled) {
    if (!img.alt || img.alt.length < MIN_ALT_LEN) {
      failures.push({
        scope: `homepageImages[${img.section}]`,
        message:
          `alt text is required and must be ≥ ${MIN_ALT_LEN} characters ` +
          `(got ${img.alt?.length ?? 0}).`,
      });
    }
    if (!fileOnDisk(img.src)) {
      failures.push({
        scope: `homepageImages[${img.section}]`,
        message: `enabled but no file exists on disk at ${img.src}.`,
      });
    }
    if (!creditsByFile.has(img.src)) {
      failures.push({
        scope: `homepageImages[${img.section}]`,
        message:
          `enabled but no matching credit in imageCredits.ts ` +
          `(looking for file: "${img.src}").`,
      });
    }
  }

  // ── credit rules ─────────────────────────────────────────────────
  for (const credit of imageCredits) {
    if (!fileOnDisk(credit.file)) {
      failures.push({
        scope: `imageCredits[${credit.file}]`,
        message: `credit references a file that does not exist on disk.`,
      });
    }
    if (!credit.photographer || credit.photographer.trim().length === 0) {
      failures.push({
        scope: `imageCredits[${credit.file}]`,
        message: `photographer is required (cannot be empty).`,
      });
    }
    if (!credit.sourceUrl || !credit.sourceUrl.startsWith("https://")) {
      failures.push({
        scope: `imageCredits[${credit.file}]`,
        message: `sourceUrl must start with "https://" (got "${credit.sourceUrl}").`,
      });
    }
    if (!ALLOWED_LICENSES.has(credit.license)) {
      failures.push({
        scope: `imageCredits[${credit.file}]`,
        message:
          `license must be one of ${Array.from(ALLOWED_LICENSES).join(", ")} ` +
          `(got "${credit.license}").`,
      });
    }
  }

  if (failures.length > 0) {
    console.error("verify-homepage-images: FAIL");
    for (const f of failures) {
      console.error(`  ✗ ${f.scope}: ${f.message}`);
    }
    console.error(`\n${failures.length} problem(s).`);
    process.exit(1);
  }

  const total = HOMEPAGE_IMAGES.length;
  const enabledCount = enabled.length;
  const creditCount = imageCredits.length;
  console.log(
    `verify-homepage-images: ok — ${enabledCount}/${total} image slot(s) ` +
      `enabled, ${creditCount} credit(s) on file.`,
  );
}

main();
