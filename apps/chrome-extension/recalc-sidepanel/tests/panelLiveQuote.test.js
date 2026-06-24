const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const panelSource = fs.readFileSync(
  path.join(__dirname, "..", "panel.js"),
  "utf8",
);

test("delegates quote validation to the live backend instead of a stale local rule gate", () => {
  assert.match(panelSource, /\/api\/ext\/quote/);
  assert.doesNotMatch(panelSource, /hasMatchingQuoteRule/);
  assert.doesNotMatch(panelSource, /No hay regla activa/);
});

test("loads quote selector data from the extension bootstrap instead of the heavy web pricing endpoint", () => {
  assert.match(panelSource, /quoteRuntime/);
  assert.doesNotMatch(panelSource, /\/api\/data\/pricing-options/);
});
