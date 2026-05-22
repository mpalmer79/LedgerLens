"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

import { TransactionCarouselFallback } from "@/components/TransactionCarousel.fallback";

type TransactionCarouselProps = {
  className?: string;
};

type Transaction = {
  vendor: string;
  amount: string;
  category: string;
  color: string;
};

const TRANSACTIONS: Transaction[] = [
  { vendor: "Mitchell1",        amount: "$172.99",   category: "Software",     color: "#2e5f32" },
  { vendor: "Verizon Wireless", amount: "$89.40",    category: "Utilities",    color: "#3d7841" },
  { vendor: "Sysco Foods",      amount: "$1,247.18", category: "COGS",         color: "#244c27" },
  { vendor: "Shell",            amount: "$72.30",    category: "Fuel",         color: "#3d7841" },
  { vendor: "State Farm",       amount: "$284.00",   category: "Review queue", color: "#b8862e" },
  { vendor: "Stripe payout",    amount: "$3,420.00", category: "Revenue",      color: "#244c27" },
  { vendor: "Costco Business",  amount: "$418.62",   category: "Supplies",     color: "#3d7841" },
  { vendor: "ADP Payroll",      amount: "$8,930.00", category: "Wages",        color: "#244c27" },
  { vendor: "NAPA Auto Parts",  amount: "$215.44",   category: "Parts",        color: "#3d7841" },
  { vendor: "Claude API",       amount: "$24.80",    category: "Review queue", color: "#b8862e" },
  { vendor: "QuickBooks",       amount: "$70.00",    category: "Software",     color: "#2e5f32" },
  { vendor: "Comcast Business", amount: "$199.00",   category: "Utilities",    color: "#3d7841" },
];

const RADIUS = 5.4;
const ROTATION_SPEED = 0.22; // radians/sec
const CAMERA_HEIGHT = 3.0;
const CAMERA_DISTANCE = 10.5;

function makeCardTexture(
  vendor: string,
  amount: string,
  category: string,
  categoryColor: string,
): THREE.Texture {
  const cv = document.createElement("canvas");
  cv.width = 512;
  cv.height = 320;
  const ctx = cv.getContext("2d");
  if (!ctx) {
    throw new Error("2D canvas context unavailable");
  }

  // White card body, subtle border.
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, 512, 320);
  ctx.strokeStyle = "#d4d3c7";
  ctx.lineWidth = 4;
  ctx.strokeRect(2, 2, 508, 316);

  ctx.textBaseline = "alphabetic";

  // Field label.
  ctx.fillStyle = "#6b756b";
  ctx.font = "bold 20px Arial, sans-serif";
  ctx.fillText("TRANSACTION", 32, 52);

  // Vendor.
  ctx.fillStyle = "#1a1f1a";
  ctx.font = "bold 36px Georgia, serif";
  ctx.fillText(vendor, 32, 108);

  // Amount.
  ctx.fillStyle = "#4a534a";
  ctx.font = 'bold 28px "Courier New", monospace';
  ctx.fillText(amount, 32, 158);

  // Category chip with rounded corners (fall back to rect if roundRect unsupported).
  ctx.font = "bold 22px Arial, sans-serif";
  const chipW = ctx.measureText(category).width + 60;
  ctx.fillStyle = categoryColor;
  if (typeof ctx.roundRect === "function") {
    ctx.beginPath();
    ctx.roundRect(32, 215, chipW, 56, 8);
    ctx.fill();
  } else {
    ctx.fillRect(32, 215, chipW, 56);
  }
  ctx.fillStyle = "#ffffff";
  ctx.fillText(category, 62, 252);

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
  useEffect(() => {
    if (typeof window === "undefined") return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const isMobile = window.matchMedia("(max-width: 768px)").matches;
    const disabled = document.body.dataset.disable3d === "true";
    setUseFallback(reducedMotion || isMobile || disabled);
  }, []);

  useEffect(() => {
    if (useFallback !== false) return; // null = still detecting, true = use fallback
    const container = containerRef.current;
    if (!container) return;

    let width = container.clientWidth;
    let height = container.clientHeight;
    if (width === 0 || height === 0) {
      // Defer until layout has settled.
      width = 600;
      height = 400;
    }

    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(0, CAMERA_HEIGHT, CAMERA_DISTANCE);
    camera.lookAt(0, 0.2, 0);

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.setClearColor(0x000000, 0);
    container.appendChild(renderer.domElement);

    // Lights.
    const ambient = new THREE.AmbientLight(0xffffff, 0.85);
    scene.add(ambient);
    const directional = new THREE.DirectionalLight(0xffffff, 0.45);
    directional.position.set(2, 8, 5);
    scene.add(directional);

    // Cards.
    const cardGeom = new THREE.BoxGeometry(3.0, 1.9, 0.08);
    const textures: THREE.Texture[] = [];
    const materials: THREE.Material[] = [];
    const cards: THREE.Mesh[] = [];

    TRANSACTIONS.forEach((tx) => {
      const tex = makeCardTexture(tx.vendor, tx.amount, tx.category, tx.color);
      textures.push(tex);

      const front = new THREE.MeshStandardMaterial({
        map: tex,
        roughness: 0.55,
        side: THREE.FrontSide,
      });
      const back = new THREE.MeshStandardMaterial({
        color: 0xf5f5f0,
        roughness: 0.55,
        side: THREE.FrontSide,
      });
      materials.push(front, back);

      // Material order: [+X, -X, +Y, -Y, +Z (front), -Z (back)].
      const card = new THREE.Mesh(cardGeom, [back, back, back, back, front, back]);
      cards.push(card);
      scene.add(card);
    });

    const startTime = Date.now();
    let rafId = 0;

    const animate = () => {
      rafId = requestAnimationFrame(animate);
      const elapsed = (Date.now() - startTime) * 0.001;

      cards.forEach((card, i) => {
        const angle = (i / TRANSACTIONS.length) * Math.PI * 2 + elapsed * ROTATION_SPEED;
        const x = Math.sin(angle) * RADIUS;
        const z = Math.cos(angle) * RADIUS;
        card.position.set(x, 0, z);
        card.rotation.y = angle;

        // Opacity by depth: front arc opaque, back arc translucent.
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
      camera.lookAt(0, 0.2, 0);

      renderer.render(scene, camera);
    };

    animate();

    // Resize via ResizeObserver — the container can change size when surrounding
    // layout shifts. window.addEventListener('resize') misses those cases.
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

  if (useFallback === null) {
    // First render before detection runs; render nothing to avoid flashing the
    // fallback for users who will get the 3D scene anyway.
    return <div ref={containerRef} className={className} aria-hidden="true" />;
  }

  if (useFallback) {
    return <TransactionCarouselFallback className={className} />;
  }

  return <div ref={containerRef} className={className} aria-hidden="true" />;
}
