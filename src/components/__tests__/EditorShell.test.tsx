import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { EditorShell } from "../EditorShell";
import { createSeedDocuments } from "../../domain/seeds";
import { createEmptyComboBuffer } from "../../domain/models";

describe("EditorShell", () => {
  it("holds slot edits locally until the user saves the profile draft", async () => {
    const user = userEvent.setup();
    const seed = createSeedDocuments("2026-04-13T00:00:00.000Z");
    const saveProfile = vi.fn().mockResolvedValue(undefined);
    const saveSettings = vi.fn().mockResolvedValue(undefined);

    render(
      <EditorShell
        comboState={createEmptyComboBuffer()}
        editorProfileId="therxspot"
        importExportText="{}"
        onApplyImportText={vi.fn()}
        onDeleteRecipe={vi.fn()}
        onEditorProfileChange={vi.fn()}
        onExportPack={vi.fn()}
        onImportFile={vi.fn()}
        onImportTextChange={vi.fn()}
        onSaveProfile={saveProfile}
        onSaveRecipe={vi.fn()}
        onSaveSettings={saveSettings}
        onSelectSlot={vi.fn()}
        profiles={seed.profilesDocument.profiles}
        resolvedProfileId="therxspot"
        settings={seed.settingsDocument.settings}
        slotSelection={{ bankId: "A", slotIndex: 0 }}
      />,
    );

    const labelInput = screen.getByDisplayValue("Repo map");
    await user.clear(labelInput);
    await user.type(labelInput, "Repo map updated");

    expect(saveProfile).not.toHaveBeenCalled();

    // Click the "Save all" button that appears when there are unsaved changes
    const saveAllButton = screen.getByRole("button", { name: /save all/i });
    await user.click(saveAllButton);
    expect(saveProfile).toHaveBeenCalledTimes(1);
    expect(saveProfile.mock.calls[0][0].bankA.slots[0].label).toBe("Repo map updated");
  });

  it("applies import text only when explicitly requested", async () => {
    const user = userEvent.setup();
    const seed = createSeedDocuments("2026-04-13T00:00:00.000Z");
    const onImportTextChange = vi.fn();
    const onApplyImportText = vi.fn().mockResolvedValue(undefined);

    render(
      <EditorShell
        comboState={createEmptyComboBuffer()}
        editorProfileId="global-workflow"
        importExportText='{"format":"superpaste-pack"}'
        onApplyImportText={onApplyImportText}
        onDeleteRecipe={vi.fn()}
        onEditorProfileChange={vi.fn()}
        onExportPack={vi.fn()}
        onImportFile={vi.fn()}
        onImportTextChange={onImportTextChange}
        onSaveProfile={vi.fn()}
        onSaveRecipe={vi.fn()}
        onSaveSettings={vi.fn()}
        onSelectSlot={vi.fn()}
        profiles={seed.profilesDocument.profiles}
        resolvedProfileId="global-workflow"
        settings={seed.settingsDocument.settings}
        slotSelection={{ bankId: "B", slotIndex: 0 }}
      />,
    );

    // Need to expand the Import/Export section first since it's collapsed by default
    const importExportSection = screen.getByRole("button", { name: /import \/ export/i });
    await user.click(importExportSection);

    const textarea = screen.getByDisplayValue('{"format":"superpaste-pack"}');
    await user.type(textarea, " ");

    expect(onApplyImportText).not.toHaveBeenCalled();
    expect(onImportTextChange).toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Apply JSON" }));
    expect(onApplyImportText).toHaveBeenCalledTimes(1);
  });
});
