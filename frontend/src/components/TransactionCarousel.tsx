"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

import { TransactionCarouselFallback } from "@/components/TransactionCarousel.fallback";

type TransactionCarouselProps = {
  className?: string;
};

type CardStatus = "Auto-posted" | "Review queue";

type Transaction = {
  // Input face
  date: string;
  account: string;
  vendor: string;
  amount: string;
  memo: string;
  // Decision face
  category: string;
  confidence: number;
  rationale: string;
  status: CardStatus;
};

const TRANSACTIONS: Transaction[] = [
  {
    date: "2026-03-14",
    account: "Operating ····4471",
    vendor: "Mitchell1",
    amount: "$172.99",
    memo: "Auto repair manuals · subscription",
    category: "Software",
    confidence: 0.91,
    rationale: "Recurring software subscription for shop tech reference",
    status: "Auto-posted",
  },
  {
    date: "2026-03-13",
    account: "Operating ····4471",
    vendor: "Verizon Wireless",
    amount: "$89.40",
    memo: "Business line · monthly",
    category: "Utilities",
    confidence: 0.95,
    rationale: "Recurring telecom charge matches Utilities pattern",
    status: "Auto-posted",
  },
  {
    date: "2026-03-13",
    account: "Operating ····4471",
    vendor: "Sysco Foods",
    amount: "$1,247.18",
    memo: "Wholesale food · weekly delivery",
    category: "COGS",
    confidence: 0.94,
    rationale: "Wholesale food distributor → COGS for cafe vertical",
    status: "Auto-posted",
  },
  {
    date: "2026-03-12",
    account: "Operating ····4471",
    vendor: "Shell",
    amount: "$72.30",
    memo: "Fuel · company vehicle",
    category: "Fuel",
    confidence: 0.88,
    rationale: "Fuel station purchase typical of fleet expense",
    status: "Auto-posted",
  },
  {
    date: "2026-03-12",
    account: "Operating ····4471",
    vendor: "State Farm",
    amount: "$284.00",
    memo: "Monthly insurance · auto policy",
    category: "Insurance · Possible prepaid",
    confidence: 0.58,
    rationale: "Could be Insurance Expense or Prepaid Asset · needs human",
    status: "Review queue",
  },
  {
    date: "2026-03-11",
    account: "Operating ····4471",
    vendor: "Stripe payout",
    amount: "$3,420.00",
    memo: "Daily settlement · net of fees",
    category: "Revenue",
    confidence: 0.96,
    rationale: "Payment processor settlement → Revenue",
    status: "Auto-posted",
  },
  {
    date: "2026-03-11",
    account: "Operating ····4471",
    vendor: "Costco Business",
    amount: "$418.62",
    memo: "Bulk supplies · paper goods",
    category: "Supplies",
    confidence: 0.83,
    rationale: "Wholesale bulk supplier in Supplies category for SMB",
    status: "Auto-posted",
  },
  {
    date: "2026-03-10",
    account: "Operating ····4471",
    vendor: "ADP Payroll",
    amount: "$8,930.00",
    memo: "Bi-weekly payroll run",
    category: "Wages",
    confidence: 0.97,
    rationale: "Payroll processor disbursement → Wages",
    status: "Auto-posted",
  },
  {
    date: "2026-03-10",
    account: "Operating ····4471",
    vendor: "NAPA Auto Parts",
    amount: "$215.44",
    memo: "Parts order · shop inventory",
    category: "Parts",
    confidence: 0.86,
    rationale: "Auto parts distributor → Parts for shop vertical",
    status: "Auto-posted",
  },
  {
    date: "2026-03-09",
    account: "Operating ····4471",
    vendor: "Claude API",
    amount: "$24.80",
    memo: "API usage · variable",
    category: "Software · Possible R&D",
    confidence: 0.54,
    rationale: "Could be Software Expense or capitalized R&D · needs human",
    status: "Review queue",
  },
  {
    date: "2026-03-09",
    account: "Operating ····4471",
    vendor: "QuickBooks",
    amount: "$70.00",
    memo: "Accounting software · monthly",
    category: "Software",
    confidence: 0.93,
    rationale: "Recurring accounting software subscription",
    status: "Auto-posted",
  },
  {
    date: "2026-03-08",
    account: "Operating ····4471",
    vendor: "Comcast Business",
    amount: "$199.00",
    memo: "Internet · business class",
    category: "Utilities",
    confidence: 0.94,
    rationale: "Recurring business internet charge → Utilities",
    status: "Auto-posted",
  },
];

const RADIUS = 5.4;
const ROTATION_SPEED = 0.22; // radians/sec — unchanged from 9b
const CAMERA_HEIGHT = 3.0;
const CAMERA_DISTANCE = 10.5;
// Aim the camera below the ring's plane so the ring renders in the upper
// portion of the frame, vertically aligned with the headline rather than the
// hero's midpoint. See ADR-0013 / Session 10b polish notes.
const LOOK_AT_Y = -1.0;

// Flip animation — once per revolution, centered on the back arc where the
// card is invisible to the viewer. See ADR-0014.
const FLIP_ARC_HALF_WIDTH = 0.6; // radians; ~70° arc total
const FLIP_START = Math.PI - FLIP_ARC_HALF_WIDTH;
const FLIP_END = Math.PI + FLIP_ARC_HALF_WIDTH;

// Status palette.
const COLOR_AUTOPOST_DARK = "#2e5f32";
const COLOR_AUTOPOST_LIGHT = "#dceadd";
const COLOR_AUTOPOST_BG = "#f0f7f1";
const COLOR_AUTOPOST_BORDER = "#b8d4ba";
const COLOR_AUTOPOST_TEXT = "#142a16";
const COLOR_AUTOPOST_STATUS_TEXT = "#244c27";

const COLOR_REVIEW_DARK = "#b8862e";
const COLOR_REVIEW_LIGHT = "#faeeda";
const COLOR_REVIEW_BORDER = "#fac775";
const COLOR_REVIEW_TEXT = "#633806";

function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

// Word-wrap a string into up to `maxLines` lines fitting `maxWidth` pixels,
// truncating the last line with an ellipsis if it overflows.
function wrapLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number,
): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (ctx.measureText(candidate).width <= maxWidth || !current) {
      current = candidate;
    } else {
      lines.push(current);
      current = word;
      if (lines.length === maxLines) break;
    }
  }
  if (current && lines.length < maxLines) lines.push(current);

  // If we ran out of room mid-text, truncate the last line.
  if (words.join(" ") !== lines.join(" ")) {
    let last = lines[lines.length - 1];
    while (ctx.measureText(`${last}…`).width > maxWidth && last.length > 1) {
      last = last.slice(0, -1);
    }
    lines[lines.length - 1] = `${last}…`;
  }
  return lines;
}

function drawCardChassis(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, 512, 320);
  ctx.strokeStyle = "#d4d3c7";
  ctx.lineWidth = 4;
  ctx.strokeRect(2, 2, 508, 316);
}

function fillRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  if (typeof ctx.roundRect === "function") {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    ctx.fill();
  } else {
    ctx.fillRect(x, y, w, h);
  }
}

function strokeRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  if (typeof ctx.roundRect === "function") {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    ctx.stroke();
  } else {
    ctx.strokeRect(x, y, w, h);
  }
}

function makeInputFaceTexture(tx: Transaction): THREE.CanvasTexture {
  const cv = document.createElement("canvas");
  cv.width = 512;
  cv.height = 320;
  const ctx = cv.getContext("2d");
  if (!ctx) throw new Error("2D canvas context unavailable");

  drawCardChassis(ctx);
  ctx.textBaseline = "alphabetic";

  // Header row: date left, account right.
  ctx.fillStyle = "#6b756b";
  ctx.font = 'bold 18px "Courier New", monospace';
  ctx.textAlign = "left";
  ctx.fillText(tx.date, 32, 46);
  ctx.textAlign = "right";
  ctx.fillText(tx.account, 480, 46);
  ctx.textAlign = "left";

  // Vendor.
  ctx.fillStyle = "#1a1f1a";
  ctx.font = "bold 38px Georgia, serif";
  ctx.fillText(truncate(tx.vendor, 14), 32, 120);

  // Amount.
  ctx.fillStyle = "#4a534a";
  ctx.font = 'bold 30px "Courier New", monospace';
  ctx.fillText(tx.amount, 32, 170);

  // Hairline divider.
  ctx.strokeStyle = "#e5e4dc";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(32, 210);
  ctx.lineTo(480, 210);
  ctx.stroke();

  // Memo.
  ctx.fillStyle = "#6b756b";
  ctx.font = "italic 18px Georgia, serif";
  ctx.fillText(truncate(tx.memo, 38), 32, 248);

  const tex = new THREE.CanvasTexture(cv);
  tex.needsUpdate = true;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = 4;
  return tex;
}

function makeDecisionFaceTexture(tx: Transaction): THREE.CanvasTexture {
  const cv = document.createElement("canvas");
  cv.width = 512;
  cv.height = 320;
  const ctx = cv.getContext("2d");
  if (!ctx) throw new Error("2D canvas context unavailable");

  drawCardChassis(ctx);
  ctx.textBaseline = "alphabetic";

  const isReview = tx.status === "Review queue";
  const barColor = isReview ? COLOR_REVIEW_DARK : COLOR_AUTOPOST_DARK;
  const pillBg = isReview ? COLOR_REVIEW_LIGHT : COLOR_AUTOPOST_LIGHT;
  const pillText = isReview ? COLOR_REVIEW_TEXT : COLOR_AUTOPOST_TEXT;

  // Category pill at top.
  ctx.font = "bold 18px Arial, sans-serif";
  const catW = ctx.measureText(tx.category).width + 28;
  ctx.fillStyle = pillBg;
  fillRoundedRect(ctx, 32, 44, catW, 32, 6);
  ctx.fillStyle = pillText;
  ctx.textAlign = "left";
  ctx.fillText(tx.category, 32 + 14, 66);

  // CONFIDENCE micro-label + numeric.
  ctx.fillStyle = "#6b756b";
  ctx.font = "bold 14px Arial, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("CONFIDENCE", 32, 120);

  ctx.fillStyle = "#1a1f1a";
  ctx.font = 'bold 22px "Courier New", monospace';
  ctx.textAlign = "right";
  ctx.fillText(tx.confidence.toFixed(2), 480, 120);
  ctx.textAlign = "left";

  // Confidence bar: track + fill.
  ctx.fillStyle = "#e5e4dc";
  fillRoundedRect(ctx, 32, 138, 448, 10, 4);
  ctx.fillStyle = barColor;
  fillRoundedRect(ctx, 32, 138, 448 * tx.confidence, 10, 4);

  // Rationale (wrap to 2 lines max).
  ctx.fillStyle = "#4a534a";
  ctx.font = "17px Georgia, serif";
  const rationaleLines = wrapLines(ctx, tx.rationale, 448, 2);
  for (let i = 0; i < rationaleLines.length; i += 1) {
    ctx.fillText(rationaleLines[i], 32, 192 + i * 24);
  }

  // Status badge at bottom.
  const badgeBg = isReview ? COLOR_REVIEW_LIGHT : COLOR_AUTOPOST_BG;
  const badgeBorder = isReview ? COLOR_REVIEW_BORDER : COLOR_AUTOPOST_BORDER;
  const badgeTextColor = isReview ? COLOR_REVIEW_TEXT : COLOR_AUTOPOST_STATUS_TEXT;
  const dotColor = isReview ? COLOR_REVIEW_DARK : COLOR_AUTOPOST_DARK;

  ctx.font = "bold 16px Arial, sans-serif";
  const statusTextW = ctx.measureText(tx.status).width;
  const badgeW = 8 /* dot */ + 8 /* gap */ + statusTextW + 24; /* padding */
  const badgeX = 32;
  const badgeY = 256;
  const badgeH = 32;

  ctx.fillStyle = badgeBg;
  fillRoundedRect(ctx, badgeX, badgeY, badgeW, badgeH, 6);
  ctx.strokeStyle = badgeBorder;
  ctx.lineWidth = 1;
  strokeRoundedRect(ctx, badgeX, badgeY, badgeW, badgeH, 6);

  // Dot.
  ctx.fillStyle = dotColor;
  ctx.beginPath();
  ctx.arc(badgeX + 16, badgeY + badgeH / 2, 4, 0, Math.PI * 2);
  ctx.fill();

  // Text.
  ctx.fillStyle = badgeTextColor;
  ctx.fillText(tx.status, badgeX + 28, badgeY + 21);

  const tex = new THREE.CanvasTexture(cv);
  tex.needsUpdate = true;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = 4;
  return tex;
}

export function TransactionCarousel({ className }: TransactionCarouselProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [useFallback, setUseFallback] = useState<boolean | null>(null);

  // Detect prefers-reduced-motion, mobile width, and the document opt-out flag.
  // Listen for live changes too — some users toggle reduced-motion mid-session.
  useEffect(() => {
    if (typeof window === "undefined") return;

    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const mobileQuery = window.matchMedia("(max-width: 768px)");
    const disabled = document.body.dataset.disable3d === "true";

    const evaluate = () => {
      setUseFallback(motionQuery.matches || mobileQuery.matches || disabled);
    };
    evaluate();

    motionQuery.addEventListener("change", evaluate);
    mobileQuery.addEventListener("change", evaluate);
    return () => {
      motionQuery.removeEventListener("change", evaluate);
      mobileQuery.removeEventListener("change", evaluate);
    };
  }, []);

  useEffect(() => {
    if (useFallback !== false) return;
    const container = containerRef.current;
    if (!container) return;

    let width = container.clientWidth;
    let height = container.clientHeight;
    if (width === 0 || height === 0) {
      width = 600;
      height = 400;
    }

    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(0, CAMERA_HEIGHT, CAMERA_DISTANCE);
    camera.lookAt(0, LOOK_AT_Y, 0);

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.setClearColor(0x000000, 0);
    renderer.domElement.setAttribute("aria-hidden", "true");
    container.appendChild(renderer.domElement);

    const ambient = new THREE.AmbientLight(0xffffff, 0.85);
    scene.add(ambient);
    const directional = new THREE.DirectionalLight(0xffffff, 0.45);
    directional.position.set(2, 8, 5);
    scene.add(directional);

    // Cards: shared geometry, per-card input + decision textures.
    const cardGeom = new THREE.BoxGeometry(3.0, 1.9, 0.08);
    const textures: THREE.Texture[] = [];
    const materials: THREE.Material[] = [];
    const cards: THREE.Mesh[] = [];

    TRANSACTIONS.forEach((tx) => {
      const inputTex = makeInputFaceTexture(tx);
      const decisionTex = makeDecisionFaceTexture(tx);
      textures.push(inputTex, decisionTex);

      const inputMat = new THREE.MeshStandardMaterial({
        map: inputTex,
        roughness: 0.55,
        side: THREE.FrontSide,
      });
      const decisionMat = new THREE.MeshStandardMaterial({
        map: decisionTex,
        roughness: 0.55,
        side: THREE.FrontSide,
      });
      const edgeMat = new THREE.MeshStandardMaterial({
        color: 0xf5f5f0,
        roughness: 0.55,
        side: THREE.FrontSide,
      });
      materials.push(inputMat, decisionMat, edgeMat);

      // Material order: [+X, -X, +Y, -Y, +Z (input front), -Z (decision back)].
      const card = new THREE.Mesh(cardGeom, [
        edgeMat,
        edgeMat,
        edgeMat,
        edgeMat,
        inputMat,
        decisionMat,
      ]);
      cards.push(card);
      scene.add(card);
    });

    const startTime = Date.now();
    let rafId = 0;

    const animate = () => {
      rafId = requestAnimationFrame(animate);
      const elapsed = (Date.now() - startTime) * 0.001;

      cards.forEach((card, i) => {
        const baseAngle = (i / TRANSACTIONS.length) * Math.PI * 2 + elapsed * ROTATION_SPEED;

        // Position on circle.
        const x = Math.sin(baseAngle) * RADIUS;
        const z = Math.cos(baseAngle) * RADIUS;
        card.position.set(x, 0, z);

        // Determine flip state for this revolution.
        // angleInRev is 0 (front center) to 2π. Back center is at π.
        const angleInRev = ((baseAngle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);

        let flipProgress: number;
        if (angleInRev < FLIP_START) {
          flipProgress = 0;
        } else if (angleInRev > FLIP_END) {
          flipProgress = 1;
        } else {
          flipProgress = (angleInRev - FLIP_START) / (FLIP_END - FLIP_START);
        }

        // Each full revolution toggles which face starts visible. Direction
        // alternates so the card unflips on the next pass through the back arc.
        const revolutionCount = Math.floor(baseAngle / (Math.PI * 2));
        const flipDirection = revolutionCount % 2 === 0 ? 1 : -1;
        const flipRotation = Math.PI * flipProgress * flipDirection;

        card.rotation.y = baseAngle + flipRotation;

        // Opacity by depth — unchanged from 9b.
        const frontness = (z + RADIUS) / (RADIUS * 2);
        const opacity = Math.max(0.15, 0.35 + frontness * 0.65);
        (card.material as THREE.Material[]).forEach((m) => {
          m.transparent = true;
          m.opacity = opacity;
        });
      });

      // Subtle camera breathing.
      camera.position.x = Math.sin(elapsed * 0.08) * 0.3;
      camera.position.y = CAMERA_HEIGHT + Math.sin(elapsed * 0.06) * 0.15;
      camera.lookAt(0, LOOK_AT_Y, 0);

      renderer.render(scene, camera);
    };

    animate();

    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = entry.contentRect.width;
        const h = entry.contentRect.height;
        if (w === 0 || h === 0) continue;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
      }
    });
    ro.observe(container);

    return () => {
      cancelAnimationFrame(rafId);
      ro.disconnect();
      textures.forEach((tex) => tex.dispose());
      materials.forEach((mat) => mat.dispose());
      cardGeom.dispose();
      renderer.domElement.remove();
      renderer.dispose();
    };
  }, [useFallback]);

  const ariaLabel =
    "Animated illustration of bank transactions being categorized by LedgerLens";

  if (useFallback === null) {
    return <div ref={containerRef} className={className} role="img" aria-label={ariaLabel} />;
  }
  if (useFallback) {
    return <TransactionCarouselFallback className={className} />;
  }
  return <div ref={containerRef} className={className} role="img" aria-label={ariaLabel} />;
}
