import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { inflateSync } from "node:zlib";

import { describe, expect, it } from "vitest";

const root = process.cwd();
const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function paeth(left: number, up: number, upLeft: number) {
  const p = left + up - upLeft;
  const pa = Math.abs(p - left);
  const pb = Math.abs(p - up);
  const pc = Math.abs(p - upLeft);
  if (pa <= pb && pa <= pc) return left;
  return pb <= pc ? up : upLeft;
}

function decodePngRgba(relativePath: string) {
  const input = readFileSync(resolve(root, relativePath));
  expect(input.subarray(0, 8)).toEqual(pngSignature);

  let offset = 8;
  let width = 0;
  let height = 0;
  let colorType = 0;
  const idatChunks: Buffer[] = [];
  while (offset < input.length) {
    const length = input.readUInt32BE(offset);
    const type = input.toString("ascii", offset + 4, offset + 8);
    const data = input.subarray(offset + 8, offset + 8 + length);
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      colorType = data[9];
      expect(data[8]).toBe(8);
      expect(data[12]).toBe(0);
    }
    if (type === "IDAT") idatChunks.push(Buffer.from(data));
    offset += 12 + length;
    if (type === "IEND") break;
  }

  const bytesPerPixel = colorType === 6 ? 4 : 3;
  expect([3, 4]).toContain(bytesPerPixel);
  const raw = inflateSync(Buffer.concat(idatChunks));
  const rowBytes = width * bytesPerPixel;
  const pixels = Buffer.alloc(width * height * bytesPerPixel);
  let cursor = 0;
  for (let y = 0; y < height; y++) {
    const filter = raw[cursor++];
    const row = y * rowBytes;
    const previous = row - rowBytes;
    for (let x = 0; x < rowBytes; x++) {
      const value = raw[cursor++];
      const left = x >= bytesPerPixel ? pixels[row + x - bytesPerPixel] : 0;
      const up = y > 0 ? pixels[previous + x] : 0;
      const upLeft = y > 0 && x >= bytesPerPixel ? pixels[previous + x - bytesPerPixel] : 0;
      const decoded =
        filter === 0
          ? value
          : filter === 1
            ? value + left
            : filter === 2
              ? value + up
              : filter === 3
                ? value + Math.floor((left + up) / 2)
                : value + paeth(left, up, upLeft);
      pixels[row + x] = decoded & 0xff;
    }
  }

  return { width, height, bytesPerPixel, pixels };
}

function isOpaqueNearWhitePixel(input: ReturnType<typeof decodePngRgba>, x: number, y: number) {
  const index = y * input.width * input.bytesPerPixel + x * input.bytesPerPixel;
  const r = input.pixels[index] ?? 0;
  const g = input.pixels[index + 1] ?? 0;
  const b = input.pixels[index + 2] ?? 0;
  const a = input.bytesPerPixel === 4 ? input.pixels[index + 3] ?? 255 : 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return a > 16 && min >= 238 && max - min <= 42;
}

describe("floating calculator assets", () => {
  it("prioritizes the collapsed rail image because it is above the fold", () => {
    const source = readFileSync(
      resolve(root, "apps/web/src/components/unidep/FloatingCalculator.tsx"),
      "utf8",
    );

    const railImage = source.match(
      /<Image[\s\S]*?className="ui-floating-calculator__rail-image"[\s\S]*?\/>/,
    );

    expect(railImage?.[0]).toContain("priority");
  });

  it("keeps the floating calculator PNG transparent around the cutout", () => {
    const image = decodePngRgba("apps/web/public/branding/floating-calculator.png");
    let opaqueNearWhitePixels = 0;

    for (let y = 0; y < image.height; y++) {
      for (let x = 0; x < image.width; x++) {
        if (isOpaqueNearWhitePixel(image, x, y)) {
          opaqueNearWhitePixels += 1;
        }
      }
    }

    expect(opaqueNearWhitePixels).toBeLessThan(1200);
  });
});
