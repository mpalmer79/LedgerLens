/**
 * PhotoCredits behavior.
 *
 * Today the credit array ships empty, so the component must render
 * nothing visible. The populated-state structure is covered by the
 * page-content test that reads the component source.
 */
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { imageCredits } from "@/data/imageCredits";

import { PhotoCredits } from "./PhotoCredits";

describe("PhotoCredits", () => {
  it("ships with an empty imageCredits array", () => {
    expect(imageCredits.length).toBe(0);
  });

  it("renders nothing visible when imageCredits is empty", () => {
    const html = renderToStaticMarkup(<PhotoCredits />);
    expect(html).toBe("");
  });
});
