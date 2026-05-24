/**
 * HomepageImageSlot — placeholder vs real-image rendering.
 */
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import type { HomepageImage } from "@/data/homepageImages";

import { HomepageImageSlot } from "./HomepageImageSlot";

const base: HomepageImage = {
  section: "hero",
  src: "/images/stock/hero/calm-workspace-morning.jpg",
  alt: "Tidy desk with laptop and notebook in soft morning light",
  enabled: false,
  aspect: "21:9",
  placement: "homepage hero",
  placeholderTitle: "Hero image slot",
  placeholderNote: "1600×900 · calm-workspace-morning.jpg",
};

describe("HomepageImageSlot", () => {
  it("renders placeholder panel when enabled=false", () => {
    const html = renderToStaticMarkup(
      <HomepageImageSlot image={base} className="aspect-[16/5]" />,
    );
    expect(html).toContain("Hero image slot");
    expect(html).toContain("calm-workspace-morning.jpg");
    expect(html).toContain('data-testid="image-slot-hero"');
    expect(html).not.toContain("<img");
  });

  it("shows placeholderTitle and placeholderNote text", () => {
    const html = renderToStaticMarkup(
      <HomepageImageSlot image={base} className="aspect-[16/5]" />,
    );
    expect(html).toContain(base.placeholderTitle);
    expect(html).toContain(base.placeholderNote);
  });

  it("renders real image when enabled=true", () => {
    const enabled = { ...base, enabled: true };
    const html = renderToStaticMarkup(
      <HomepageImageSlot image={enabled} className="aspect-[16/5]" />,
    );
    expect(html).toContain("<img");
    expect(html).toContain("calm-workspace-morning.jpg");
    expect(html).not.toContain("Hero image slot");
  });

  it("uses no icons, emoji, or illustrations in placeholder", () => {
    const html = renderToStaticMarkup(
      <HomepageImageSlot image={base} className="aspect-[4/3]" />,
    );
    expect(html).not.toContain("<svg");
    expect(html).not.toMatch(/lucide/i);
  });
});
