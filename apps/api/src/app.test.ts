import assert from "node:assert/strict";
import test from "node:test";
import { HealthController } from "./modules/health/health.controller.js";

test("health controller returns ok status", () => {
  const controller = new HealthController();
  const result = controller.getHealth();

  assert.equal(result.ok, true);
  assert.equal(result.service, "api");
  assert.ok(result.timestamp);
});
