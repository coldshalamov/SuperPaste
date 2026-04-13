import { describe, expect, it } from "vitest";
import { parseRecipeSteps, serializeRecipeSteps } from "../recipes";

describe("recipe serialization", () => {
  it("serializes and parses slot and super steps", () => {
    const text = serializeRecipeSteps([
      { type: "slot", slotRef: { bankId: "A", slotIndex: 1 } },
      { type: "slot", slotRef: { bankId: "B", slotIndex: 5 } },
      { type: "super", superId: "checkout-bughunt-super" },
    ]);

    expect(text).toBe("A2 > B6 > super:checkout-bughunt-super");
    expect(parseRecipeSteps(text)).toEqual([
      { type: "slot", slotRef: { bankId: "A", slotIndex: 1 } },
      { type: "slot", slotRef: { bankId: "B", slotIndex: 5 } },
      { type: "super", superId: "checkout-bughunt-super" },
    ]);
  });

  it("rejects invalid step tokens", () => {
    expect(() => parseRecipeSteps("A2 > nope")).toThrow(/Invalid recipe step/i);
  });
});
