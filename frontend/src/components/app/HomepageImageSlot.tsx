import Image from "next/image";

import type { HomepageImage } from "@/data/homepageImages";

/**
 * A single homepage image slot.
 *
 * - `enabled: true` — renders the real local photo via `next/image`.
 * - `enabled: false` — renders a professional placeholder panel
 *   styled as a deliberate wireframe (muted background, subtle grid
 *   texture, section label, filename, aspect). No icons, no SVGs,
 *   no illustrations, no emoji.
 *
 * The placeholder makes the homepage's visual plan visible before the
 * real files are dropped in. Switching from placeholder to photo
 * requires only a manifest flag flip + a credit entry — no homepage
 * code changes.
 */
export function HomepageImageSlot({
  image,
  className = "",
  priority = false,
  sizes,
}: {
  image: HomepageImage;
  className?: string;
  priority?: boolean;
  sizes?: string;
}) {
  if (image.enabled) {
    return (
      <div className={`relative w-full overflow-hidden ${className}`}>
        <Image
          src={image.src}
          alt={image.alt}
          fill
          priority={priority}
          sizes={sizes ?? "(min-width: 1024px) 1024px, 100vw"}
          className="object-cover"
        />
      </div>
    );
  }

  const filename = image.src.split("/").pop() ?? image.src;

  return (
    <div
      className={`relative flex w-full flex-col items-center justify-center overflow-hidden ${className}`}
      style={{
        background:
          "repeating-linear-gradient(" +
          "0deg, transparent, transparent 39px, rgba(0,0,0,0.04) 39px, rgba(0,0,0,0.04) 40px" +
          "), " +
          "repeating-linear-gradient(" +
          "90deg, transparent, transparent 39px, rgba(0,0,0,0.04) 39px, rgba(0,0,0,0.04) 40px" +
          "), " +
          "#f5f3ef",
      }}
      role="img"
      aria-label={`Placeholder for ${image.placeholderTitle}`}
      data-testid={`image-slot-${image.section}`}
    >
      <p className="text-[18px] font-medium tracking-tight text-[#6b6560] sm:text-[22px]">
        {image.placeholderTitle}
      </p>
      <p className="mt-1 text-[12px] tracking-wide text-[#9e968e] sm:text-[13px]">
        {image.placeholderNote}
      </p>
    </div>
  );
}
