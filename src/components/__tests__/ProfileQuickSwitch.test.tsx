import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ProfileQuickSwitch } from "../ProfileQuickSwitch";
import { createSeedDocuments } from "../../domain/seeds";

describe("ProfileQuickSwitch", () => {
  it("lets the user switch to auto or a specific profile with keyboard-friendly controls", async () => {
    const user = userEvent.setup();
    const seed = createSeedDocuments("2026-04-13T00:00:00.000Z");
    const onSelectProfile = vi.fn();

    render(
      <ProfileQuickSwitch
        activeOverrideId={null}
        onSelectProfile={onSelectProfile}
        profiles={seed.profilesDocument.profiles}
        resolvedProfileId="therxspot"
      />,
    );

    const select = screen.getByLabelText("Profile override");
    await user.selectOptions(select, "global-workflow");
    expect(onSelectProfile).toHaveBeenCalledWith("global-workflow");

    await user.selectOptions(select, "__auto__");
    expect(onSelectProfile).toHaveBeenCalledWith(null);
  });
});
