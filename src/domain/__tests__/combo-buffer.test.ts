import { describe, expect, it } from "vitest";
import {
  cancelCombo,
  finalizeCombo,
  queueSlot,
  queueSuper,
  removeLastQueuedEntry,
  replayLast,
  toggleStance,
} from "../combo-engine";
import { createEmptyComboBuffer } from "../models";
import { resolveProfile } from "../profile-resolution";
import { createSeedDocuments } from "../seeds";

function resolveRxSpotLoadout() {
  const seed = createSeedDocuments("2026-04-13T00:00:00.000Z");
  const resolved = resolveProfile(seed.profilesDocument.profiles, seed.settingsDocument.settings, {
    title: "VS Code",
    processName: "code.exe",
    processPath: "",
    workspacePath: "TheRxSpot.com",
  });

  return {
    seed,
    resolved,
    loadout: {
      bankA: resolved.effectiveBankA.slots,
      bankB: resolved.effectiveBankB.slots,
      supers: resolved.effectiveSupers,
      assembly: resolved.effectiveAssembly,
    },
  };
}

describe("combo buffer basics", () => {
  it("queues slots and finalizes in order", () => {
    const { seed, resolved, loadout } = resolveRxSpotLoadout();

    const queued = queueSlot(queueSlot(createEmptyComboBuffer(), { bankId: "A", slotIndex: 2 }), {
      bankId: "B",
      slotIndex: 5,
    });

    const { finalized, nextState } = finalizeCombo(queued, loadout, seed.settingsDocument.settings, {
      clipboard: "",
      profile: resolved.profile.name,
      active_app: "code.exe",
      date: "2026-04-13",
    });

    expect(finalized?.text).toContain("State the failing behavior");
    expect(finalized?.text).toContain("Do a repo sweep");
    expect(nextState.queuedEntries).toHaveLength(0);
  });

  it("lets a latched wrap stance envelope the queued combo", () => {
    const { seed, resolved, loadout } = resolveRxSpotLoadout();
    const patchOnly = loadout.bankB[0]!;
    patchOnly.templateMode = "template";
    patchOnly.assemblyMode = "wrap";
    patchOnly.content = "PATCH MODE\n\n{{clipboard}}\n\nDo not widen scope.";

    const withStance = toggleStance(queueSlot(createEmptyComboBuffer(), { bankId: "A", slotIndex: 0 }), {
      bankId: "B",
      slotIndex: 0,
    });

    const { finalized } = finalizeCombo(withStance, loadout, seed.settingsDocument.settings, {
      clipboard: "",
      profile: resolved.profile.name,
      active_app: "code.exe",
      date: "2026-04-13",
    });

    expect(finalized?.text.startsWith("PATCH MODE")).toBe(true);
    expect(finalized?.text).toContain("Capture the relevant repo or module map");
    expect(finalized?.text.endsWith("Do not widen scope.")).toBe(true);
  });

  it("expands supers with their own assembly joiner and allows replay", () => {
    const { seed, resolved, loadout } = resolveRxSpotLoadout();

    const queued = queueSuper(createEmptyComboBuffer(), "checkout-bughunt-super");
    const { nextState, finalized } = finalizeCombo(queued, loadout, seed.settingsDocument.settings, {
      clipboard: "",
      profile: resolved.profile.name,
      active_app: "code.exe",
      date: "2026-04-13",
    });

    expect(finalized?.sequence).toHaveLength(3);
    expect(finalized?.text).toContain("Do a repo sweep");
    expect(finalized?.text).not.toContain("---");
    expect(replayLast(nextState)?.text).toBe(finalized?.text);
  });

  it("supports wrapper templates using clipboard variables", () => {
    const { seed, resolved, loadout } = resolveRxSpotLoadout();
    const workflowSlot = loadout.bankB[1]!;
    workflowSlot.templateMode = "template";
    workflowSlot.assemblyMode = "wrap";
    workflowSlot.content = "Before editing, summarize this context:\n\n{{clipboard}}\n\nProfile: {{profile}}";

    const queued = queueSlot(createEmptyComboBuffer(), { bankId: "B", slotIndex: 1 });
    const { finalized } = finalizeCombo(queued, loadout, seed.settingsDocument.settings, {
      clipboard: "Original clipboard context",
      profile: resolved.profile.name,
      active_app: "code.exe",
      date: "2026-04-13",
    });

    expect(finalized?.text).toContain("Original clipboard context");
    expect(finalized?.text).toContain("Profile: TheRxSpot.com");
  });

  it("keeps non-wrap stance clipboard templates bound to the system clipboard", () => {
    const { seed, resolved, loadout } = resolveRxSpotLoadout();
    const stanceSlot = loadout.bankB[0]!;
    stanceSlot.templateMode = "template";
    stanceSlot.assemblyMode = "append";
    stanceSlot.content = "STANCE CLIPBOARD: {{clipboard}}";

    const withStance = toggleStance(
      queueSlot(createEmptyComboBuffer(), { bankId: "A", slotIndex: 0 }),
      { bankId: "B", slotIndex: 0 },
    );

    const { finalized } = finalizeCombo(withStance, loadout, seed.settingsDocument.settings, {
      clipboard: "SYSTEM CLIPBOARD VALUE",
      profile: resolved.profile.name,
      active_app: "code.exe",
      date: "2026-04-13",
    });

    expect(finalized?.text).toContain("STANCE CLIPBOARD: SYSTEM CLIPBOARD VALUE");
    expect(finalized?.text).not.toContain("STANCE CLIPBOARD: Capture the relevant repo or module map");
  });

  it("removes the last queued entry without dropping latched stances", () => {
    const withQueue = queueSlot(
      queueSlot(createEmptyComboBuffer(), { bankId: "A", slotIndex: 0 }),
      { bankId: "B", slotIndex: 1 },
    );
    const withStance = toggleStance(withQueue, { bankId: "B", slotIndex: 3 });

    const nextState = removeLastQueuedEntry(withStance);

    expect(nextState.queuedEntries).toHaveLength(1);
    expect(nextState.queuedEntries[0]?.slotRef).toEqual({ bankId: "A", slotIndex: 0 });
    expect(nextState.activeStances).toEqual([{ bankId: "B", slotIndex: 3 }]);
  });

  it("cancels queued combo entries but keeps stances latched", () => {
    const withQueue = queueSlot(createEmptyComboBuffer(), { bankId: "A", slotIndex: 0 });
    const withStance = toggleStance(withQueue, { bankId: "B", slotIndex: 2 });

    const nextState = cancelCombo(withStance);

    expect(nextState.queuedEntries).toHaveLength(0);
    expect(nextState.activeStances).toEqual([{ bankId: "B", slotIndex: 2 }]);
    expect(nextState.lastFinalized).toBeNull();
  });
});
