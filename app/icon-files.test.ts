import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const appDir = dirname(fileURLToPath(import.meta.url));

describe("app icons", () => {
  it("ships an SVG lockup in Mars Bank colours", () => {
    const svg = readFileSync(join(appDir, "icon.svg"), "utf8");

    expect(svg).toContain('aria-label="Mars Bank"');
    expect(svg).toContain("#101518");
    expect(svg).toContain("#e4623f");
    expect(svg).toContain("#356CFF");
  });

  it("ships a PNG Apple icon at 180px", () => {
    const png = readFileSync(join(appDir, "apple-icon.png"));

    expect(png.subarray(0, 8)).toEqual(
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    );
    expect(png.readUInt32BE(16)).toBe(180);
    expect(png.readUInt32BE(20)).toBe(180);
  });

  it("ships a favicon.ico that browsers request by default", () => {
    const ico = readFileSync(join(appDir, "favicon.ico"));

    expect(ico.readUInt16LE(0)).toBe(0);
    expect(ico.readUInt16LE(2)).toBe(1);
    expect(ico.readUInt16LE(4)).toBeGreaterThanOrEqual(1);
  });
});
