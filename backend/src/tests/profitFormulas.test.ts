import test from "node:test";
import assert from "node:assert/strict";
import {
  getAdminBasePrice,
  computeResellerOrderProfit,
  computeAdminOrderProfit,
} from "../services/profitFormulas.js";

test("computeResellerOrderProfit: selling 8, base 6 -> profit 2", () => {
  assert.equal(computeResellerOrderProfit(8, 6), 2);
});

test("computeAdminOrderProfit: base 6, API 4.5 -> profit 1.5", () => {
  assert.equal(computeAdminOrderProfit(6, 4.5), 1.5);
});

test("getAdminBasePrice uses reseller base for store orders", () => {
  assert.equal(
    getAdminBasePrice("reseller_store", { resellerBasePrice: 6, agentPrice: 5 }),
    6
  );
});

test("getAdminBasePrice uses dealer price for dealer orders", () => {
  assert.equal(
    getAdminBasePrice("agent", { resellerBasePrice: 6, agentPrice: 5 }),
    5
  );
});
