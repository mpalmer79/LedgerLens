import type { Metadata } from "next";

import { GeneratedWalkthrough } from "@/components/marketing/GeneratedWalkthrough";

export const metadata: Metadata = {
  title: "Walkthrough recording helper",
  description:
    "A clean, full-screen render of the generated walkthrough so it can be captured with Loom, OBS, or any screen recorder.",
  robots: { index: false, follow: false },
};

/**
 * Clean full-screen render of the generated walkthrough. No app shell, no
 * nav, no marketing chrome — designed so Michael can point a screen
 * recorder at this URL and capture a 30-second clip without anything
 * extra in the frame.
 *
 * Aspect ratio is locked to 16:9 with a `vw`/`vh`-aware container that
 * sizes to the largest video-shaped box that fits the viewport. Capture
 * the inner card, not the surrounding letterbox.
 */
export default function WalkthroughPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-black p-4">
      <div className="w-full max-w-[1280px]">
        <div className="text-center">
          <p className="mb-2 text-[11px] uppercase tracking-[2px] text-zinc-500">
            Recording helper · monthly cleanup to accountant handoff
          </p>
        </div>
        <div
          className="mx-auto overflow-hidden rounded-lg shadow-2xl"
          style={{ aspectRatio: "16 / 9" }}
        >
          <GeneratedWalkthrough />
        </div>
        <p className="mt-3 text-center text-[11px] text-zinc-500">
          Once recorded, set <span className="font-mono">NEXT_PUBLIC_LOOM_URL</span> on the
          frontend deploy to swap this for the real Loom embed on the homepage.
        </p>
      </div>
    </main>
  );
}
