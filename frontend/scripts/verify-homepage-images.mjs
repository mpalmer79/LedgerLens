#!/usr/bin/env node
/**
 * Verify the homepage's stock-photography system is consistent.
 *
 *  1. Every entry in src/data/imageCredits.ts has a file on disk.
 *  2. Every JSX `src="/images/stock/..."` reference has an entry.
 *  3. Every file under public/images/stock/ has either an entry
 *     or is documented as a placeholder.
 *
 * Exits 0 on success with a one-line summary; exits 1 with a
 * blunt failure list otherwise. Plain Node + zero deps so it
 * runs in any CI without a TypeScript build step.
 */
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const FRONTEND = resolve(HERE, "..");
const PUBLIC = join(FRONTEND, "public");
const STOCK = join(PUBLIC, "images", "stock");
const CREDITS_PATH = join(FRONTEND, "src", "data", "imageCredits.ts");
const HOMEPAGE_PATH = join(FRONTEND, "src", "app", "page.tsx");

function readFile(p) {
  return readFileSync(p, "utf-8");
}

function listFilesRecursive(dir) {
  const out = [];
  function walk(d) {
    for (const name of readdirSync(d)) {
      const full = join(d, name);
      const s = statSync(full);
      if (s.isDirectory()) {
        walk(full);
      } else {
        out.push(full);
      }
    }
  }
  walk(dir);
  return out;
}

function parseCreditsFiles(source) {
  // Crude but correct enough: pick out `file: "..."` literals.
  const re = /file:\s*"(\/images\/stock\/[^"]+)"/g;
  const found = [];
  let m;
  while ((m = re.exec(source)) !== null) {
    found.push(m[1]);
  }
  return found;
}

function parseHomepageImageSrcs(source) {
  // Match either src="..." or src={".. ${var}"} forms; the latter
  // would be impossible to verify statically so we ignore it.
  const re = /src\s*=\s*"(\/images\/stock\/[^"]+)"/g;
  const found = [];
  let m;
  while ((m = re.exec(source)) !== null) {
    found.push(m[1]);
  }
  return found;
}

function fail(label, items) {
  console.error(`\n  ✗ ${label}:`);
  for (const item of items) console.error(`      - ${item}`);
}

function main() {
  if (!existsSync(STOCK)) {
    console.error(`✗ public/images/stock/ does not exist (${STOCK})`);
    process.exit(1);
  }
  if (!existsSync(CREDITS_PATH)) {
    console.error(`✗ src/data/imageCredits.ts missing`);
    process.exit(1);
  }
  if (!existsSync(HOMEPAGE_PATH)) {
    console.error(`✗ src/app/page.tsx missing`);
    process.exit(1);
  }

  const creditsSrc = readFile(CREDITS_PATH);
  const homepageSrc = readFile(HOMEPAGE_PATH);

  const credits = parseCreditsFiles(creditsSrc);
  const usedInJsx = parseHomepageImageSrcs(homepageSrc);
  const onDisk = listFilesRecursive(STOCK)
    .map((f) => "/" + f.slice(PUBLIC.length + 1).replace(/\\/g, "/"));

  const onDiskSet = new Set(onDisk);
  const creditsSet = new Set(credits);
  const usedSet = new Set(usedInJsx);

  const missingFiles = credits.filter((c) => !onDiskSet.has(c));
  const missingCredits = onDisk.filter((f) => !creditsSet.has(f));
  const unreferencedCredits = credits.filter((c) => !usedSet.has(c));
  const usedWithoutCredit = usedInJsx.filter((u) => !creditsSet.has(u));

  const failures = [];
  if (missingFiles.length) {
    fail("credit entries with no file on disk", missingFiles);
    failures.push("missing files");
  }
  if (missingCredits.length) {
    fail("files on disk with no credit entry", missingCredits);
    failures.push("orphan files");
  }
  if (usedWithoutCredit.length) {
    fail("homepage `src=` references with no credit entry", usedWithoutCredit);
    failures.push("uncredited usage");
  }
  if (unreferencedCredits.length) {
    fail("credit entries not used by the homepage", unreferencedCredits);
    failures.push("unused credits");
  }

  if (failures.length) {
    console.error(`\nverify-homepage-images: FAIL (${failures.join(", ")})`);
    process.exit(1);
  }

  console.log(
    `verify-homepage-images: ok — ${credits.length} credits, ` +
      `${onDisk.length} files on disk, ${usedInJsx.length} used in homepage.`,
  );
}

main();
