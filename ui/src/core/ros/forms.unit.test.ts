import { describe, expect, it } from "vitest";
import {
  getRosTypeTemplate,
  hasKnownPublishSchema,
  hasKnownServiceSchema,
  validatePublishPayload,
  validateServiceArgs,
} from "./forms";

describe("ros form validation", () => {
  it("blocks invalid Twist publish payloads with field-level errors", () => {
    const result = validatePublishPayload(
      "geometry_msgs/msg/Twist",
      JSON.stringify({ linear: { x: "fast" }, angular: { z: 1 } }),
    );

    expect(result.ok).toBe(false);
    expect(result.errors).toContain("linear.x must be a number");
    expect(result.errors).toContain("linear.y must be a number");
    expect(result.errors).toContain("angular.x must be a number");
  });

  it("accepts valid service args for known schemas", () => {
    expect(validateServiceArgs("std_srvs/srv/SetBool", '{"data": true}')).toMatchObject({
      ok: true,
    });
    expect(
      validateServiceArgs("rosclaw_msgs/srv/GetCapabilities", '{"robot_namespace": "/demo"}'),
    ).toMatchObject({ ok: true });
  });

  it("falls back to generic JSON validation for unknown types", () => {
    expect(validatePublishPayload("custom_msgs/msg/Thing", '{"value": 3}')).toMatchObject({
      ok: true,
    });
    expect(hasKnownPublishSchema("custom_msgs/msg/Thing")).toBe(false);
    expect(hasKnownServiceSchema("std_srvs/srv/Trigger")).toBe(true);
    expect(getRosTypeTemplate("geometry_msgs/msg/Twist")).toContain('"linear"');
  });
});