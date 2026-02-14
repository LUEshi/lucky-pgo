import test from "node:test";
import assert from "node:assert/strict";
import { parseCsv } from "../src/utils/csvParser.js";

test("parses Noibat/Noivern from TSV groups without treating them as headers", () => {
  const text =
    "65\tAlakazam\t\tTRUE\t637\tVolcarona\t\tTRUE\t714\tNoibat\t\tTRUE\t715\tNoivern\t\tFALSE";

  const parsed = parseCsv(text);
  const noibat = parsed.find((p) => p.dexNumber === 714);
  const noivern = parsed.find((p) => p.dexNumber === 715);

  assert.ok(noibat);
  assert.equal(noibat.name, "Noibat");
  assert.equal(noibat.isLucky, true);

  assert.ok(noivern);
  assert.equal(noivern.name, "Noivern");
  assert.equal(noivern.isLucky, false);
});

test("still rejects literal header labels like 'No.' as Pokemon names", () => {
  const text = "1\tNo.\tTRUE\n714\tNoibat\tTRUE";
  const parsed = parseCsv(text);

  assert.equal(parsed.some((p) => p.dexNumber === 1), false);
  assert.equal(parsed.some((p) => p.dexNumber === 714), true);
});
