import test from "node:test";
import assert from "node:assert/strict";
import { getRaidTradeNote } from "../src/utils/tradeRules.js";

test("returns null when raid target is not needed", () => {
  const note = getRaidTradeNote({
    name: "Dialga",
    tier: "5-Star Raids",
    isShadow: false,
    isNeeded: false,
  });
  assert.equal(note, null);
});

test("marks 5-star legendary-tier raids as special trades", () => {
  const note = getRaidTradeNote({
    name: "Palkia",
    tier: "5-Star Raids",
    isShadow: false,
    isNeeded: true,
  });
  assert.equal(note, "Special Trade");
});

test("marks shadow non-legendary raids as purify plus special trade", () => {
  const note = getRaidTradeNote({
    name: "Shadow Stantler",
    tier: "3-Star Raids",
    isShadow: true,
    isNeeded: true,
  });
  assert.equal(note, "Purify + Special Trade");
});

test("marks shadow legendary-tier raids as purify plus special trade", () => {
  const note = getRaidTradeNote({
    name: "Shadow Regigigas",
    tier: "5-Star Raids",
    isShadow: true,
    isNeeded: true,
  });
  assert.equal(note, "Purify + Special Trade");
});

test("marks mythical raid bosses as untradable", () => {
  const note = getRaidTradeNote({
    name: "Darkrai",
    tier: "5-Star Raids",
    isShadow: false,
    isNeeded: true,
  });
  assert.equal(note, "Can't Trade (Mythical)");
});

test("handles mythical forms via base-name matching", () => {
  const note = getRaidTradeNote({
    name: "Deoxys (Attack Forme)",
    tier: "5-Star Raids",
    isShadow: false,
    isNeeded: true,
  });
  assert.equal(note, "Can't Trade (Mythical)");
});
