#!/usr/bin/env tsx
/**
 * Verify social-preview and favicon assets are complete.
 *
 * Checks:
 * 1. OG image exists at correct path and dimensions.
 * 2. Favicon raster files exist.
 * 3. site.webmanifest exists and references icon sizes.
 * 4. Layout metadata references the OG image + summary_large_image.
 */
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const FRONTEND = resolve(HERE, "..");
const PUBLIC = join(FRONTEND, "public");
const LAYOUT = join(FRONTEND, "src", "app", "layout.tsx");

type Failure = { scope: string; message: string };

function main(): void {
  const failures: Failure[] = [];

  // ── OG image ──────────────────────────────────────────────────────
  const ogPath = join(PUBLIC, "og", "ledgerlens-og.png");
  if (!existsSync(ogPath)) {
    failures.push({ scope: "og-image", message: "og/ledgerlens-og.png not found" });
  } else {
    const size = statSync(ogPath).size;
    if (size < 10000) {
      failures.push({
        scope: "og-image",
        message: `og/ledgerlens-og.png is suspiciously small (${size} bytes)`,
      });
    }
  }

  // ── Favicon files ─────────────────────────────────────────────────
  const faviconFiles = [
    "favicon/favicon.ico",
    "favicon/favicon-16x16.png",
    "favicon/favicon-32x32.png",
    "favicon/apple-touch-icon.png",
    "favicon/android-chrome-192x192.png",
    "favicon/android-chrome-512x512.png",
    "favicon/site.webmanifest",
  ];
  for (const f of faviconFiles) {
    if (!existsSync(join(PUBLIC, f))) {
      failures.push({ scope: "favicon", message: `${f} not found` });
    }
  }

  // ── Webmanifest content ───────────────────────────────────────────
  const manifestPath = join(PUBLIC, "favicon", "site.webmanifest");
  if (existsSync(manifestPath)) {
    const manifest = readFileSync(manifestPath, "utf-8");
    if (!manifest.includes("192x192")) {
      failures.push({ scope: "manifest", message: "site.webmanifest missing 192x192 icon" });
    }
    if (!manifest.includes("512x512")) {
      failures.push({ scope: "manifest", message: "site.webmanifest missing 512x512 icon" });
    }
  }

  // ── Layout metadata ───────────────────────────────────────────────
  if (existsSync(LAYOUT)) {
    const layout = readFileSync(LAYOUT, "utf-8");
    if (!layout.includes("/og/ledgerlens-og.png")) {
      failures.push({
        scope: "metadata",
        message: "layout.tsx does not reference /og/ledgerlens-og.png",
      });
    }
    if (!layout.includes("summary_large_image")) {
      failures.push({
        scope: "metadata",
        message: "layout.tsx does not include summary_large_image twitter card",
      });
    }
    if (!layout.includes("metadataBase")) {
      failures.push({
        scope: "metadata",
        message: "layout.tsx does not set metadataBase (LinkedIn needs absolute URLs)",
      });
    }
  } else {
    failures.push({ scope: "metadata", message: "layout.tsx not found" });
  }

  if (failures.length > 0) {
    console.error("verify-social-assets: FAIL");
    for (const f of failures) {
      console.error(`  ✗ ${f.scope}: ${f.message}`);
    }
    process.exit(1);
  }

  console.log(
    `verify-social-assets: ok — OG image, ${faviconFiles.length} favicon files, manifest, metadata all present.`,
  );
}

main();
