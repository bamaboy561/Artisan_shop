import assert from "node:assert/strict";
import test from "node:test";

import {
  optimizeCutting,
  type OptimizerPiece,
} from "../features/services/cut-optimizer";

const KERF = 4;
const W = 2730;
const H = 1810;

function random(seed: number) {
  return () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };
}

function check(pieces: OptimizerPiece[]) {
  const result = optimizeCutting(pieces, W, H, KERF);
  const seen = new Set<string>();
  const byId = new Map(pieces.map((piece) => [piece.id, piece]));

  for (const sheet of result.sheets) {
    const placed = sheet.placements;
    for (const item of placed) {
      assert.ok(!seen.has(item.id), `${item.id} placed twice`);
      seen.add(item.id);
      const piece = byId.get(item.id)!;
      assert.ok(item.x >= 0 && item.y >= 0, "inside the sheet");
      assert.ok(
        item.x + item.width <= W + 1e-6 && item.y + item.height <= H + 1e-6,
        "inside the sheet",
      );
      const same = item.width === piece.width && item.height === piece.height;
      const turned = item.width === piece.height && item.height === piece.width;
      assert.ok(same || turned, "keeps its size");
      if (piece.orientationMode === "fixed")
        assert.ok(same, "fixed piece is not turned");
    }
    for (let i = 0; i < placed.length; i += 1) {
      for (let j = i + 1; j < placed.length; j += 1) {
        const a = placed[i];
        const b = placed[j];
        const apart =
          a.x + a.width + KERF <= b.x + 1e-6 ||
          b.x + b.width + KERF <= a.x + 1e-6 ||
          a.y + a.height + KERF <= b.y + 1e-6 ||
          b.y + b.height + KERF <= a.y + 1e-6;
        assert.ok(apart, `${a.id} and ${b.id} overlap or miss the saw cut`);
      }
    }
  }

  assert.equal(seen.size + result.unplacedIds.length, pieces.length);
  return result;
}

test("random cut lists are laid out without overlaps", () => {
  for (let seed = 1; seed <= 25; seed += 1) {
    const next = random(seed);
    const pieces: OptimizerPiece[] = Array.from(
      { length: 10 + Math.floor(next() * 80) },
      (_, index) => ({
        id: `p${index}`,
        width: 100 + Math.floor(next() * 1500),
        height: 60 + Math.floor(next() * 900),
        orientationMode: next() < 0.4 ? "fixed" : "free",
      }),
    );
    check(pieces);
  }
});

test("eight equal doors share one sheet", () => {
  const pieces: OptimizerPiece[] = Array.from({ length: 8 }, (_, index) => ({
    id: `door${index}`,
    width: 670,
    height: 890,
    orientationMode: "fixed",
  }));
  assert.equal(check(pieces).sheets.length, 1);
});

test("a piece larger than the sheet is reported, not lost", () => {
  const result = check([
    { id: "big", width: 3000, height: 500, orientationMode: "fixed" },
    { id: "small", width: 500, height: 500, orientationMode: "free" },
  ]);
  assert.deepEqual(result.unplacedIds, ["big"]);
  assert.equal(result.sheets.length, 1);
});
