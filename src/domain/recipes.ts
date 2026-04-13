import { RecipeEntry, SlotReference } from "./models";

function parseSlotReferenceToken(token: string): SlotReference | null {
  const match = /^([AB])([1-9]|0)$/i.exec(token.trim());
  if (!match) {
    return null;
  }

  return {
    bankId: match[1]!.toUpperCase() as "A" | "B",
    slotIndex: match[2] === "0" ? 9 : Number(match[2]) - 1,
  };
}

export function serializeRecipeSteps(steps: RecipeEntry[]) {
  return steps
    .map((step) =>
      step.type === "slot"
        ? `${step.slotRef.bankId}${step.slotRef.slotIndex === 9 ? "0" : step.slotRef.slotIndex + 1}`
        : `super:${step.superId}`,
    )
    .join(" > ");
}

export function parseRecipeSteps(text: string): RecipeEntry[] {
  return text
    .split(">")
    .map((token) => token.trim())
    .filter(Boolean)
    .map((token) => {
      if (token.toLowerCase().startsWith("super:")) {
        const superId = token.slice("super:".length).trim();
        if (!superId) {
          throw new Error("Recipe step references an empty super id.");
        }

        return {
          type: "super" as const,
          superId,
        };
      }

      const slotRef = parseSlotReferenceToken(token);
      if (!slotRef) {
        throw new Error(`Invalid recipe step "${token}". Use A1..A0, B1..B0, or super:<id>.`);
      }

      return {
        type: "slot" as const,
        slotRef,
      };
    });
}
