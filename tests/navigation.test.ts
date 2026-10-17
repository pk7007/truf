import { describe, expect, it } from "vitest";
import { safeInternalHref } from "@/lib/navigation";

describe("safeInternalHref", () => {
  it("keeps local paths, queries, and fragments", () => {
    expect(safeInternalHref("/app/matches?id=one#details")).toBe(
      "/app/matches?id=one#details",
    );
  });

  it.each([
    "https://example.com",
    "//example.com/path",
    "javascript:alert(1)",
    "app/matches",
    null,
  ])("rejects unsafe destination %s", (value) =>
    expect(safeInternalHref(value)).toBe("/app/notifications"),
  );
});
