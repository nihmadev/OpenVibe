import assert from "node:assert/strict";
import test from "node:test";

import { isNewerVersion, parseUpdateChoice } from "../dist/update-policy.js";

test("parses update choices", () => {
  assert.equal(parseUpdateChoice("y"), "install");
  assert.equal(parseUpdateChoice("n"), "skip");
  assert.equal(parseUpdateChoice("never"), "disable");
  assert.equal(parseUpdateChoice("invalid"), "invalid");
});

test("only treats a greater version as an update", () => {
  assert.equal(isNewerVersion("1.3.4", "1.3.2"), true);
  assert.equal(isNewerVersion("1.3.4", "1.3.4"), false);
  assert.equal(isNewerVersion("1.3.3", "1.3.4"), false);
  assert.equal(isNewerVersion("2.0.0", "2.0.0-beta.1"), true);
});
