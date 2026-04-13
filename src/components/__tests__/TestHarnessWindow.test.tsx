import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TestHarnessWindow } from "../TestHarnessWindow";

describe("TestHarnessWindow", () => {
  it("renders manual smoke instructions and a focus target", () => {
    render(<TestHarnessWindow />);

    expect(screen.getByRole("heading", { name: /test harness/i })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /test harness input/i })).toBeInTheDocument();
    expect(screen.getByText(/paste Bank A/i)).toBeInTheDocument();
  });
});
