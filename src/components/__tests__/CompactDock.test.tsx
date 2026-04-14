import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { CompactDock } from "../CompactDock";
import { createSeedDocuments } from "../../domain/seeds";
import { createEmptyComboBuffer } from "../../domain/models";

describe("CompactDock", () => {
  it("renders both banks and lets the user paste or edit a slot", async () => {
    const user = userEvent.setup();
    const seed = createSeedDocuments("2026-04-13T00:00:00.000Z");
    const globalProfile = seed.profilesDocument.profiles.find((profile) => profile.id === "global-workflow")!;
    const pasteSlot = vi.fn();
    const editSlot = vi.fn();

    render(
      <CompactDock
        activeBuffer={createEmptyComboBuffer()}
        activeProfileName="TheRxSpot.com"
        bankA={seed.profilesDocument.profiles.find((profile) => profile.id === "therxspot")!.bankA}
        bankB={globalProfile.bankB}
        finalizedPreview=""
        isHotkeysPaused={false}
        hasHotkeyWarnings={false}
        isPasteReady
        onCancelCombo={vi.fn()}
        onCopyCombo={vi.fn()}
        onEditSlot={editSlot}
        onPasteCombo={vi.fn()}
        onPasteSlot={pasteSlot}
        onQueueSlot={vi.fn()}
        onQueueSuper={vi.fn()}
        onRemoveLast={vi.fn()}
        onReplayLast={vi.fn()}
        onToggleStance={vi.fn()}
        profileReason="workspacePathContains matched"
        supers={globalProfile.supers}
      />,
    );

    expect(screen.getByText("Bank A")).toBeInTheDocument();
    expect(screen.getByText("Bank B")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Paste slot A1" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Paste slot A1" }));
    expect(pasteSlot).toHaveBeenCalledWith({ bankId: "A", slotIndex: 0 });

    await user.click(screen.getAllByRole("button", { name: "Edit slot" })[0]);
    expect(editSlot).toHaveBeenCalledWith({ bankId: "A", slotIndex: 0 });
  });

  it("shows queued entries and active stances in the combo HUD", () => {
    const seed = createSeedDocuments("2026-04-13T00:00:00.000Z");
    const profile = seed.profilesDocument.profiles.find((entry) => entry.id === "therxspot")!;
    const workflow = seed.profilesDocument.profiles.find((entry) => entry.id === "global-workflow")!;

    render(
      <CompactDock
        activeBuffer={{
          queuedEntries: [
            { type: "slot", slotRef: { bankId: "A", slotIndex: 2 } },
            { type: "super", superId: "repo-bughunt-super" },
          ],
          activeStances: [{ bankId: "B", slotIndex: 0 }],
          lastFinalized: null,
        }}
        activeProfileName={profile.name}
        bankA={profile.bankA}
        bankB={workflow.bankB}
        finalizedPreview="assembled"
        isHotkeysPaused={false}
        hasHotkeyWarnings={false}
        isPasteReady
        onCancelCombo={vi.fn()}
        onCopyCombo={vi.fn()}
        onEditSlot={vi.fn()}
        onPasteCombo={vi.fn()}
        onPasteSlot={vi.fn()}
        onQueueSlot={vi.fn()}
        onQueueSuper={vi.fn()}
        onRemoveLast={vi.fn()}
        onReplayLast={vi.fn()}
        onToggleStance={vi.fn()}
        profileReason="Manual override"
        supers={workflow.supers}
      />,
    );

    // Queued slot label appears in combo queue
    const queuedSlots = screen.getAllByText("Repro + bug trail");
    expect(queuedSlots.length).toBeGreaterThanOrEqual(1);

    // Queued super recipe shows the recipe name (appears in queue and supers list)
    const superLabels = screen.getAllByText("Repo bughunt super");
    expect(superLabels.length).toBeGreaterThanOrEqual(1);

    // Active stance label - appears as badge in combo and in the tile
    const stances = screen.getAllByText("Patch only");
    expect(stances.length).toBeGreaterThanOrEqual(1);
  });
});
